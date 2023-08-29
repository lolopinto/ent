import setuptools

with open("README.md", "r") as fh:
    long_description = fh.read()

# https://pypi.org/project/auto-schema/#history
# https://test.pypi.org/project/auto-schema-test/#history
setuptools.setup(
    name="auto_schema",  # auto_schema_test to test
    version="0.0.31",  # 0.0.32 was last test version
    author="Ola Okelola",
    author_email="email@email.com",
    description="auto schema for a db",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/lolopinto/ent/tree/master/python/auto_schema",
    packages=setuptools.find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires='==3.11',
    install_requires=["sqlalchemy==2.0.18",
                    #   "alembic @ git+https://github.com/sqlalchemy/alembic.git@dbdec2661b8a01132ea3f7a027f85fed2eaf5e54#egg=alembic",
                      "lolopinto-alembic-fork==0.0.1.dev0",
                      "datetime==4.3",
                      "psycopg2==2.9.6",
                      "ruff==0.0.285",
                      "python-dateutil==2.8.2"
                      ],
    entry_points={'console_scripts': ["auto_schema = auto_schema.cli:main"]},
    include_package_data=True
)
