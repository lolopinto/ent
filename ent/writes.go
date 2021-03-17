package ent

import (
	dbsql "database/sql"
	"fmt"

	"github.com/jmoiron/sqlx"
	"github.com/lolopinto/ent/ent/data"
	"github.com/pkg/errors"
)

// SaveChangeset is the public API for saving a changeset
func SaveChangeset(changeset Changeset) error {
	return executeOperations(changeset.GetExecutor())
}

func getStmtFromTx(tx *sqlx.Tx, db *sqlx.DB, query string) (string, *sqlx.Stmt, error) {
	var stmt *sqlx.Stmt
	var err error

	// handle if in transcation or not.
	if tx == nil {
		// automatically rebinding now but we need to handle this better later
		// TODO this is the only place i'm rebinding
		// change everything to stop using $ and now use "?"
		query = db.Rebind(query)
		stmt, err = db.Preparex(query)
	} else {
		query = tx.Rebind(query)
		stmt, err = tx.Preparex(query)
	}
	return query, stmt, err
}

/*
 * performs a write (INSERT, UPDATE, DELETE statement) given the SQL statement
 * and values to be updated in the database
 */
func performWrite(builder *sqlBuilder, tx *sqlx.Tx, entity Entity) error {
	query, values, err := builder.Build()
	if err != nil {
		return errors.Wrap(err, "error build query")
	}
	db := data.DBConn()
	if db == nil {
		err := errors.New("error getting a valid db connection")
		fmt.Println(err)
		return err
	}

	query, stmt, err := getStmtFromTx(tx, db, query)

	if err != nil {
		fmt.Println(err)
		return err
	}

	var res dbsql.Result

	checkRows := false
	if entity == nil {
		checkRows = true
		res, err = stmt.Exec(values...)
	} else {
		row := stmt.QueryRowx(values...)
		err = queryRow(row, entity)
	}
	//fmt.Println(query)

	if err != nil {
		fmt.Println(err)
		fmt.Println(query, values)
		return err
	}
	defer stmt.Close()

	// TODO may need to eventually make this optional but for now
	// let's assume all writes should affect at least one row
	if checkRows {
		// TODO this doesn't work anymore  when removing an edge that may not exist
		// so if we still care about this move this to a new layer
		rowCount, err := res.RowsAffected()
		if err != nil || rowCount == 0 {
			//fmt.Println(err, rowCount)
			return err
		}
	}
	return nil
}

// the meat of how things work
func executeOperations(exec Executor) error {
	db := data.DBConn()
	tx, err := db.Beginx()
	if err != nil {
		fmt.Println("error creating transaction", err)
		return err
	}

	for {
		op, err := exec.Operation()
		if err == ErrAllOperations {
			break
		} else if err != nil {
			return handErrInTransaction(tx, err)
		}

		resolvableOp, ok := op.(DataOperationWithResolver)
		if ok {
			if err = resolvableOp.Resolve(exec); err != nil {
				return handErrInTransaction(tx, err)
			}
		}

		// perform the write as needed
		if err = op.PerformWrite(tx); err != nil {
			return handErrInTransaction(tx, err)
		}

		// get any keys for this op and delete
		cacheableOp, ok := op.(DataOperationWithKeys)
		if cacheEnabled && ok {
			for _, key := range cacheableOp.GetCacheKeys() {
				deleteKey(key)
			}
		}
	}

	tx.Commit()
	return nil
}

func handErrInTransaction(tx *sqlx.Tx, err error) error {
	fmt.Println("error during transaction", err)
	tx.Rollback()
	return err
}
