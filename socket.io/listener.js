var url = require('url'),
		sys = require('sys'),
		options = require('./utils').options,
		Client = require('./client'),
		transports = {
			'flashsocket': require('./transports/flashsocket'),
			'htmlfile': require('./transports/htmlfile'),
			'websocket': require('./transports/websocket'),
			'xhr-multipart': require('./transports/xhr-multipart'),
			'xhr-polling': require('./transports/xhr-polling'),
			'jsonp-polling': require('./transports/jsonp-polling')
		},

Listener = module.exports = function(server, options){
	process.EventEmitter.call(this);
	var self = this;
	this.server = server;
	this.options({
		origins: '*:*',
		resource: 'socket.io',
		transports: ['websocket', 'flashsocket', 'htmlfile', 'xhr-multipart', 'xhr-polling', 'jsonp-polling'],
		transportOptions: {
			'xhr-polling': {
				timeout: null, // no heartbeats
				closeTimeout: 8000,
				duration: 20000
			},
			'jsonp-polling': {
				timeout: null, // no heartbeats
				closeTimeout: 8000,
				duration: 20000
			}
		},
		log: function(message){
			require('sys').log(message);
		}
	}, options);

	this.clients = this.clientsIndex = {};
	
	var listeners = this.server.listeners('request');
	this.server.removeAllListeners('request');
	
	this.server.addListener('request', function(req, res){
		if (self.check(req, res)) return;
		for (var i = 0, len = listeners.length; i < len; i++){
			listeners[i].call(this, req, res);
		}
	});
	
	this.server.addListener('upgrade', function(req, socket, head){
		if (!self.check(req, socket, true, head)){
			socket.destroy();
		}
	});
	
	for (var i in transports){
		if ('init' in transports[i]) transports[i].init(this);
	}
	
	this.options.log('socket.io ready - accepting connections');
};

sys.inherits(Listener, process.EventEmitter);
for (var i in options) Listener.prototype[i] = options[i];

Listener.prototype.broadcast = function(message, except){
	for (var i = 0, k = Object.keys(this.clients), l = k.length; i < l; i++){
		if (this.clients[k[i]] && (!except || [].concat(except).indexOf(this.clients[k[i]].sessionId) == -1)){
			this.clients[k[i]].send(message);
		}
	}
	return this;
};

Listener.prototype.check = function(req, res, httpUpgrade, head){
	var path = url.parse(req.url).pathname, parts, cn;
	if (path && path.indexOf('/' + this.options.resource) === 0){	
		parts = path.substr(1).split('/');
		if (!(parts[1] in transports)) return false;
		if (parts[2]){
			cn = this.clients[parts[2]];
			if (cn){
				cn._onConnect(req, res);
			} else {
				req.connection.end();
				this.options.log('Couldnt find client with session id "' + parts[2] + '"');
			}
		} else {
			this._onConnection(parts[1], req, res, httpUpgrade, head);
		}
		return true;
	}
	return false;
};

Listener.prototype._onClientConnect = function(client){
	if (!(client instanceof Client) || !client.sessionId){
		return this.options.log('Invalid client');
	}
	this.clients[client.sessionId] = client;
	this.options.log('Client '+ client.sessionId +' connected');
	this.emit('clientConnect', client);
	this.emit('connection', client);
};

Listener.prototype._onClientMessage = function(data, client){
	this.emit('clientMessage', data, client);
};

Listener.prototype._onClientDisconnect = function(client){
	delete this.clients[client.sessionId];
	this.options.log('Client '+ client.sessionId +' disconnected');
	this.emit('clientDisconnect', client);
};

Listener.prototype._onConnection = function(transport, req, res, httpUpgrade, head){
	if (this.options.transports.indexOf(transport) === -1 || (httpUpgrade && !transports[transport].httpUpgrade)){
		httpUpgrade ? res.destroy() : req.connection.destroy();
		return this.options.log('Illegal transport "'+ transport +'"');
	}
	this.options.log('Initializing client with transport "'+ transport +'"');
	new transports[transport](this, req, res, this.options.transportOptions[transport], head);
};