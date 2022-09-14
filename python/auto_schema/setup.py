import setuptools

with open("README.md", "r") as fh:
    long_description = fh.read()

# https://pypi.org/project/auto-schema/#history
# https://test.pypi.org/project/auto-schema-test/#history
setuptools.setup(
    name="auto_schema",  # auto_schema_test to test
    version="0.0.23",  # 0.0.24 was last test version
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
    python_requires='>=3.6',
    install_requires=["sqlalchemy==1.4.31",
                      "alembic==1.7.6",
                      "datetime==4.3",
                      "psycopg2==2.8.6",
                      "autopep8==1.5.4",
                      "python-dateutil==2.8.2"
                      ],
    entry_points={'console_scripts': ["auto_schema = auto_schema.cli:main"]},
    include_package_data=True
)
