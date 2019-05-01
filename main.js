const WSServer = require('./core/wsserver');
const BuildSession = require('./core/session');
const profile = require('./core/profile');
const os = require('os');
const webserver=require("./core/webserver");

let localhost;
if(os.type == 'Linux'){
	try{
		localhost = os.networkInterfaces()[Object.keys(os.networkInterfaces())[1]][0].address + ':8083';
	}catch (e) {
		localhost = '127.0.0.1:8083';
	}
}else{
	try{
		localhost = os.networkInterfaces()[Object.keys(os.networkInterfaces())[0]][1].address + ':8083';
	}catch (e) {
		localhost = '127.0.0.1:8083';
	}
}
let wss = new WSServer(8083);
webserver("host",localhost);
console.log(localhost);
console.log("OPENBUILDER");
console.log("");
wss.on('client', function(session, request) {
	webserver("buildMap",session);
	BuildSession.createAndBind(session);
	console.log(request.connection.remoteAddress.replace('::ffff:','') + profile.connected);
});