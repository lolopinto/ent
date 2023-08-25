import os

from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory

from . import runner


class Command(object):

    def __init__(self, connection, schema_path):
        alembic_cfg = Config()

        # script location is where we're running this from so keep that local
        alembic_cfg.set_main_option(
            "script_location", os.path.dirname(__file__))
        # print("env.py location", os.path.dirname(__file__))

        alembic_cfg.set_main_option(
            "version_locations", os.path.join(schema_path, "versions"))

        # should probably make some of these configurable eventually
        alembic_cfg.set_main_option(
            "file_template", "%%(rev)s_%%(year)d%%(month)d%%(day)d%%(hour)d%%(minute)d%%(second)d_%%(slug)s")
        alembic_cfg.set_main_option("truncate_slug_length", "40")
        alembic_cfg.set_main_option("timezone", "utc")  # use utc timezone.
        alembic_cfg.set_section_option(
            "alembic:exclude", "tables", runner.Runner.exclude_tables())

        # for default formatting
        alembic_cfg.set_section_option('post_write_hooks', 'hooks', 'ruff')
        alembic_cfg.set_section_option(
            'post_write_hooks', 'ruff.type', 'exec')
        alembic_cfg.set_section_option(
            'post_write_hooks', 'ruff.executable', 'ruff')
        alembic_cfg.set_section_option(
            'post_write_hooks', 'ruff.options', '--fix REVISION_SCRIPT_FILENAME --silent')

        self.alembic_cfg = alembic_cfg

        # pass connection instead of re-creating it and using a sqlalchemy_url file
        alembic_cfg.attributes['connection'] = connection

    # Returns the current revision of the database. Same as calling `alembic current`
    def current(self):
        command.current(self.alembic_cfg, verbose=True)

    # Simulates running the `alembic revision -m` command
    def revision(self, message, autogenerate=True, revision=None):
        heads = self.get_heads()
        head = 'head'
        if len(heads) > 1:
            head = heads
            
        return command.revision(self.alembic_cfg, message,
                                autogenerate=autogenerate, head=head, rev_id=revision)


    def get_script_directory(self) -> ScriptDirectory:
        return ScriptDirectory.from_config(self.alembic_cfg)
        
    def get_heads(self):
        return self.get_script_directory().get_heads()

    def get_revisions(self, revs):
        return self.get_script_directory().get_revisions(revs)

    # Simulates running the `alembic upgrade` command

    def upgrade(self, revision='head', sql=False):
        if revision == 'head':
            # check for current heads
            # if more than one, update to heads
            # and then also create merge script
            heads = self.get_heads()

            if len(heads) > 1:
                # need to change to upgrade to heads and then merge and upgrade that to head
                revision = 'heads'

        command.upgrade(self.alembic_cfg, revision, sql)

    # Simulates running the `alembic downgrade` command

    def downgrade(self, revision='', delete_files=True):
        paths = []
        if delete_files:
            paths = self._get_paths_to_delete(revision)
        command.downgrade(self.alembic_cfg, revision)

        # if downgrade worked, delete files
        location = self.alembic_cfg.get_main_option('version_locations')
        for path in paths:
            os.remove(os.path.join(location, path))

    def _get_paths_to_delete(self, revision):
        revs = list(self.get_script_directory().revision_map.iterate_revisions(
            self.get_heads(), revision, select_for_downgrade=True
        ))

        location = self.alembic_cfg.get_main_option('version_locations')

        result = []
        for _, _, filenames in os.walk(location):
            for file in filenames:
                for rev in revs:
                    if rev.revision is not None:
                        # This depends on file_template remaining as it current is in __init__
                        # if that changes, we need a regex for this too
                        if file.startswith(rev.revision):
                            result.append(file)
                            if len(result) == len(revs):
                                return result
                            break
        return result

    def get_history(self):
        return list(self.get_script_directory().walk_revisions())

    # Simulates running the `alembic history` command
    def history(self, verbose=False, last=None, rev_range=None):
        if rev_range is not None and last is not None:
            raise ValueError(
                "cannot pass both last and rev_range. please pick one")
        if last is not None:
            revs = list(self.get_script_directory().revision_map.iterate_revisions(
                self.get_heads(), '-%d' % int(last), select_for_downgrade=True
            ))
            rev_range = '%s:current' % revs[-1].revision

        command.history(self.alembic_cfg,
                        indicate_current=True, verbose=verbose, rev_range=rev_range)

    # Simulates running the `alembic current` command
    def current(self):
        command.current(self.alembic_cfg)

    # Simulates running the `alembic show` command
    def show(self, revision):
        command.show(self.alembic_cfg, revision)

    # Simulates running the `alembic heads` command
    def heads(self):
        command.heads(self.alembic_cfg, verbose=True)

    # Simulates running the `alembic branches` command
    def branches(self):
        command.branches(self.alembic_cfg, verbose=True)

    # Simulates running the `alembic stamp` command
    def stamp(self, revision):
        # TODO probably want purge=True here but need to play with stamp more to understand
        # it's annoying to stamp a revision and run into:
        # alembic.util.exc.CommandError: Can't locate revision identified by '35e0c71dcabc'
        command.stamp(self.alembic_cfg, revision)

    # Simulates running the `alembic edit` command
    # this should probably not be exposed at the moment?
    def edit(self, revision):
        command.edit(self.alembic_cfg, revision)

    def merge(self, revisions, message=None):
        command.merge(self.alembic_cfg, revisions, message=message)

