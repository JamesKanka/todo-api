var express = require('express');
var bodyParser = require('body-parser');
var _ = require('underscore');
var db = require('./db.js');
var bcrypt = require('bcrypt');
var middleware = require('./middleware.js')(db);

var app = express();
var PORT = process.env.PORT || 3000;
var todos = [];
var todoNextId = 1;

app.use(bodyParser.json());

app.get('/', function(req, res) {
	res.send('Todo API Root');
});

// GET /todos?completed=true&q=work
app.get('/todos', middleware.requireAuthentication, function(req, res) {
	var query = req.query;
	var where = {
		userId: req.user.get('id')
	}; 

	if (query.hasOwnProperty('completed') && query.completed === 'true') {
		where.completed = true;
	} else if (query.hasOwnProperty('completed') && query.completed === 'false') {
		where.completed = false;
	}

	if (query.hasOwnProperty('q') && query.q.trim().length > 0) {
		where.description = {
			$like: '%' + query.q + '%'
		};
	}
console.log(where);
	db.todo.findAll({
		where: where
	}).then(function(todos) {
		res.json(todos);
	}, function(e) {
		res.status(500).json(e);
	});
});

// GET /todos/:id
app.get('/todos/:id', middleware.requireAuthentication, function(req, res) {
	var todoId = parseInt(req.params.id, 10);
	
	db.todo.findOne({
		where: {
			id: todoId,
			userId: req.user.get('id')
		}
	}).then(function(matchedTodo) {
		if (!matchedTodo) {
			return res.status(404).send();
		}
		res.json(matchedTodo.toJSON());
	}, function(e) {
		res.status(500).json(e);
	});
});

// POST /todos
app.post('/todos', middleware.requireAuthentication, function(req, res) {
	var body = _.pick(req.body, 'description', 'completed');
	body.description = body.description.trim();
	db.todo.create(body).then(function(todo) {
		req.user.addTodo(todo).then(function () {
			return todo.reload();
		}).then(function (todo) {
			res.json(todo.toJSON());
		});
	}, function(e) {
		res.status(400).json(e);
	});
});

// DELETE /todos/:id
app.delete('/todos/:id', middleware.requireAuthentication, function(req, res) {
	var todoId = parseInt(req.params.id, 10);
	
	db.todo.findOne({
		where: {
			id: todoId,
			userId: req.user.get('id')
		}
	}).then(function(todo) {
		if (todo) {
			todo.destroy().then(function() {
				res.json(todo);
			})
		} else {
			res.status(404).json({
				error: 'No todo found with that ID'
			});
		}
	}, function(e) {
		res.status(500).send();
	})
});

// PUT /todos/:id
app.put('/todos/:id', middleware.requireAuthentication, function(req, res) {
	var body = _.pick(req.body, 'description', 'completed');
	var todoId = parseInt(req.params.id, 10);
	var attributes = {};

	if (body.hasOwnProperty('completed')) {
		attributes.completed = body.completed;
	}
	if (body.hasOwnProperty('description')) {
		attributes.description = body.description;
	}
	db.todo.findOne({
		where: {
			id: todoId,
			userId: req.user.get('id')
		}
	}).then(function(todo) {
		if (todo) {
			todo.update(attributes).then(function(todo) {
				res.json(todo.toJSON());
			}, function(e) {
				res.status(400).json(e);
			});
		} else {
			res.status(404).send();
		}
	}, function() {
		res.status(500).send();
	});
});

// POST /users
app.post('/users', function(req, res) {
	var body = _.pick(req.body, 'email', 'password');
	body.email = body.email.trim();

	db.user.create(body).then(function(user) {
		res.json(user.toPublicJSON());
	}, function(e) {
		res.status(400).json(e);
	});
});

// POST /users/login
app.post('/users/login', function(req, res) {
	var body = _.pick(req.body, 'email', 'password');
	db.user.authenticate(body).then(function (user) {
		var token = user.generateToken('authenticate');
		if (token) {
		res.header('Auth', token).json(user.toPublicJSON());
		} else {
			res.status(401).send();
		}
	}, function () {
		res.status(401).send();
	});
});



db.sequelize.sync().then(function() {
	app.listen(PORT, function() {
		console.log('Express listening to port ' + PORT + '!');
	});
})