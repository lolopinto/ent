import os

from alembic.config import Config
from alembic import command
from alembic.script import ScriptDirectory

from . import runner
from typing import TypedDict


class UpgradeInfo(TypedDict):
    unmerged_branches: bool
    merged_and_upgraded_head: bool


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
        alembic_cfg.set_section_option('post_write_hooks', 'hooks', 'autopep8')
        alembic_cfg.set_section_option(
            'post_write_hooks', 'autopep8.type', 'console_scripts')
        alembic_cfg.set_section_option(
            'post_write_hooks', 'autopep8.entrypoint', 'autopep8')
        alembic_cfg.set_section_option(
            'post_write_hooks', 'autopep8.options', '--in-place')

        self.alembic_cfg = alembic_cfg

        # pass connection instead of re-creating it and using a sqlalchemy_url file
        alembic_cfg.attributes['connection'] = connection

    # Returns the current revision of the database. Same as calling `alembic current`
    def current(self):
        command.current(self.alembic_cfg, verbose=True)

    # Simulates running the `alembic revision -m` command
    def revision(self, message):
        heads = self.get_heads()
        if len(heads) > 1:
            # if multiple heads, now safe to do a merge first before the revision since we can't
            # keep making (automatic) changes in a branch
            merge_message = self._get_merge_message(heads)
            # create a merge revision and upgrade to it
            command.merge(self.alembic_cfg, 'heads', message=merge_message)
            command.upgrade(self.alembic_cfg, 'head')

        command.revision(self.alembic_cfg, message, autogenerate=True)

    def get_heads(self):
        script = ScriptDirectory.from_config(self.alembic_cfg)

        return script.get_heads()

    def _get_merge_message(self, heads) -> str:
        return 'merge revisions %s ' % ", ".join(heads)

    # Simulates running the `alembic upgrade` command
    def upgrade(self, revision='head', merge_branches=False) -> UpgradeInfo:
        ret: UpgradeInfo = {}
        merge_message = None
        if revision == 'head':
            # check for current heads
            # if more than one, update to heads
            # and then also create merge script
            heads = self.get_heads()

            if len(heads) > 1:
                if merge_branches:
                    merge_message = self._get_merge_message(heads)
                else:
                    ret['unmerged_branches'] = True

                # need to change to upgrade to heads and then merge and upgrade that to head
                revision = 'heads'

        command.upgrade(self.alembic_cfg, revision)

        if merge_message is None:
            return ret

        # merge the heads
        command.merge(self.alembic_cfg, 'heads', message=merge_message)
        # upgrade to head
        command.upgrade(self.alembic_cfg, 'head')
        # we want to flag this back somehow so that developer knows what happened
        ret['merged_and_upgraded_head'] = True
        return ret

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
        script = ScriptDirectory.from_config(self.alembic_cfg)
        revs = list(script.revision_map.iterate_revisions(
            'head', revision, select_for_downgrade=True
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
        script = ScriptDirectory.from_config(self.alembic_cfg)
        return list(script.walk_revisions())

    # Simulates running the `alembic history` command
    def history(self):
        command.history(self.alembic_cfg, indicate_current=True)

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

    def squash(self, gen_revision, squash):
        squash = int(squash)
        if squash < 2:
            raise ValueError("squash needs to be an integer of at least 2")

        # downgrade -2 and re-run upgrade
        self.downgrade('-%d' % squash)

        # generate a new revision
        gen_revision()
        self.upgrade()
