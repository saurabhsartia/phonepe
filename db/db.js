const mysql = require('mysql')
const util = require('util')

const config = {
	host: "localhost",
	user: "root",
	password: "",
	database: "saurabh",
};
const con = mysql.createConnection(config);

const makeDb = () => {
	const connection = mysql.createConnection(config);
	return {
		query(sql, args) {
			return util.promisify(connection.query).call(connection, sql, args);
		},
		close() {
			return util.promisify(connection.end).call(connection);
		},
	};
};

module.exports = { con, makeDb } 
