const Read = require("./argv");
const Algorithms = require("./algorithms");
const helps = require("./profile").helps;
const crypto = require("crypto");
let profile = require("./profile");
let $on = true;
let $default = {};
let $history = {
	players:[],
	locate:[],
	position:[]
};
let hooks=[];
const UUIDGeneratorNode = () =>
	([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
		(c ^ (crypto.randomBytes(1)[0] & (15 >> (c / 4)))).toString(16)
	);

function callHook(thing,pass){
	for(let i of hooks){
		if(i[0]==thing)i[1](pass);
	}
}

function asleep(ms){
	return new Promise((ret)=>{
		setTimeout(ret,ms);
	});
}

class BuildSession {
	static createAndBind (session){
		let r = new BuildSession();
		r.stopall = false;
		r.session = session;
		r.init();
		return r;
	}

	init(){
		this.sendText(profile.client_connected);
		this.sendText(now() + profile.load_script,"§e");
		let that = this;
		Algorithms.LoadScript(this);
		this.session.subscribe("PlayerMessage", onPlayerMessage.bind(this));
		$default = {
			position:[0,0,0],
			block:"iron_block",
			data:0,
			method:"normal",
			block2:"",
			data2:"",
			entity:"ender_crystal"
		}
	}

	get profile(){
		return profile;
	}

	set profile(v){
		profile=v;
	}

	Hook(thing,cb){
		hooks.push([thing,cb]);
	}

	onChatMessage (msg, player, files){
		callHook("chatMessage",[msg,player]);
		let x = Read.read(msg, $default);
		if(x.server.close){
			this.sendText(profile.disconnect);
			this.session.sendCommand('closewebsocket');
		}else if(x.server.screenfetch){
			this.screenfetch(files)
		}else if(x.main.stop){
			this.stop = true;
			this.sendText(now() + profile.stopped);
		}
		this.doit(x, player, msg);
	}

	sendText (text, opts){
		callHook("beforeSendText",text);
		opts = opts ||"§b";
		this.session.sendCommand(["say",opts+"§\""+text+"§\""].join(' '));
		console.log('SendText: ' + text);
	}

	screenfetch(files) {
		
	}

	showhelp(args){
		callHook("showhelp",args);
		if(args.helpMessage){
			let $help = '';
			for (let i in helps){
				$help += i + ' ';
			}
			this.sendText($help);
			this.sendText(profile.help);
			return true;
		}else if(args.listHelp){
			for(let i in helps){
				this.sendText(helps[i]);
			}
			return true;
		}else if(args.showhelp){
			this.sendText(helps[args.showhelp]);
			return true;
		}else{
			return false;
		}
	}

	async doit(args, player, msg){
		let {main, header, build, collect, server} = args;
		let {position, block, data, method, block2, data2, entity} = header;
		let delays = main.delays;

		method = method == 'normal' ? 'replace':[method,block2,data2].join(' ');
		if(main.exec){
			let body=await this.session.sendCommand(main.exec);
			this.sendText('EXEC: ' + body.statusMessage,'§e');
			return;
		}

		if(main.eval_){
			this.sendText(this.tryEval(main.eval_));
		}

		if(collect.writeData){
			$default = header;
			this.sendText(now() + profile.wrote);
		}

		if(this.showhelp(server)){
			return;
		}

		if(main.isCmd){

			let {
				map,foo
			} = Algorithms.builder(header,build,this);

			if(!map){
				return;
			}

			else if(map.length === 0){
				this.sendText(now() + profile.inputerror1 + build[0].type + profile.inputerror2);
				return;
			}

			else if((map.length * delays) / 1000 >= 240 && !root){
				this.sendText(now() + "");
				return;
			}

			else if(build.entityMod){
				this.sendText(now() + profile.timeneed + ((map.length * delays * build[0].height) / 1000) + 's.');
			}
			else{
				this.sendText(now() + profile.timeneed + ((map.length * delays) / 1000) + 's.')
			}

			this.sendText(now() + profile.wait);

			switch (foo) {
				case 'setTile':
					this.setTile(true, map, block, data, method, delays);
					break;

				case 'setLongTile':
					this.setLongTile(true, map, build[0].height, build[0].direction, block, data, method, delays);
					break;

				case 'setEntity':
					this.setEntity(true, map, entity, delays);
					break;

				case 'setLongEntity':
					this.setLongEntity(true, map, build.height, entity, delays);
					break;

				case 'setblock':
					this.setblock(map, method, delays);
					break;

				default:
					throw new Error('Unknown function.');
					break;
			}
		}

		if(collect.get){
			this.getValue(collect.get);
		}

		else if(collect.locate){
			this.getValue('locate',collect.locate);
		}
	}

	async getValue(type, other){
		if(type == 'pos' || type == 'position'){
			let body=await this.session.sendCommandSync(['testforblock','~','~','~','air'].join(' '));
			let pos = [body.position.x,body.position.y,body.position.z];
			$default.position = pos;
			$history.position.push(pos);
			this.sendText(profile.posget + $default.position.join(' '));
			callHook("gotPosition",[body.position.x,body.position.y,body.position.z]);
		}

		else if(type == 'player' || type == 'players'){
			let body=await this.session.sendCommandSync("listd");
			let $players = body.players;
			$history.players.push($players);
			let $p = '';
			for(let i = 0 ; i < $history.players[$history.players.length - 1].length ; i++){
				$p = [$p,i,'.',$history.players[$history.players.length - 1][i],'; '].join('');
			}
			this.sendText(now() + profile.online + $p);
		}

		else if(type == 'locate'){
			let body=await this.session.sendCommandSync(['locate',other].join(' '));
			if(!body.destination){
				this.sendText(profile.notfound);
				return;
			}
			else{
				let $locate = [body.destination.x,body.destination.y,body.destination.z];
				$history.locate.push($locate);
				this.sendText(profile.found + $locate.join(' '));
				this.session.sendCommand('tp '+ $locate.join(' '));
			}
		}
	}

	async setTile(root, list, block, data, mod, delays){
		this.stop = false;
		let t = 0;
		let done = 0 ,
			time = (new Date()).getTime();
		while(true){
			if(this.stop){
				break;
			}
			this.session.sendCommand([
				'fill',
				list[t][0],list[t][1],list[t][2],
				list[t][0],list[t][1],list[t][2],
				block,
				data,
				mod
			].join(' '),() =>{
				done++;
				this.session.sendCommand(["title", "@s", "actionbar", "§b§\""
					+ done + "/" + list.length, "(" + ((done / list.length).toFixed(2) * 100) + "/100)",
					"", "Speed:", (done / (((new Date()).getTime() - time) / 1000)).toFixed(3) +
					"blocks/s" + "\nTime remaining:",
					((list.length * (((new Date()).getTime() - time)) / done) - ((new Date()).getTime() - time)) / 1000 + "s§\""
				].join(" "));
			});
			t++;
			if(t == list.length){
				this.sendText(now() + profile.generated);
				this.stop = true;
				break;
			}
			await asleep(delays);
		}
	}

	async setblock(list, mod, delays){
		this.stop = false;
		let t = 0;
		let done = 0,
			time = (new Date()).getTime();
		while(true){
			if(this.stop){
				break;
			}
			this.session.sendCommand([
				'fill',
				list[t][0],list[t][1],list[t][2],
				list[t][0],list[t][1],list[t][2],
				list[t][3],
				list[t][4],
				mod
			].join(' '),() =>{
				done++;
				this.session.sendCommand(["title", "@s", "actionbar", "§b§\""
					+ done + "/" + list.length, "(" + ((done / list.length).toFixed(2) * 100) + "/100)",
					"", "Speed:", (done / (((new Date()).getTime() - time) / 1000)).toFixed(3) +
					"blocks/s" + "\nTime remaining:",
					((list.length * (((new Date()).getTime() - time)) / done) - ((new Date()).getTime() - time)) / 1000 + "s§\""
				].join(" "));
			});
			t++;
			if(t == list.length){
				this.stop = true;
				this.sendText(now() + profile.generated);
				this.session.clearTable();
				break;
			}
			await asleep(delays);
		}
	}

	showActionbar(text, opts, cb){
		console.log([
			'title',
			'@s',
			'actionbar',
			opts + text
		].join(' '));
		this.session.sendCommand([
			'title',
			'@s',
			'actionbar',
			opts + text
		].join(' '),cb);
	}

	copyTile(list){
		this.stop = false;
		let t = 0;
		let that = this;
	}

	async setLongTile(root, list, len, direction, block, data, mod, delays){
		this.stop = false;
		let t = 0;
		let dx = direction == 'x' ? len : 1;
		let dy = direction == 'y' ? len : 1;
		let dz = direction == 'z' ? len : 1;
		let done = 0,
			time = (new Date()).getTime();
		while(true){
			if(this.stop){
				break;
			}
			this.session.sendCommand([
				'fill',
				list[t][0],list[t][1],list[t][2],
				list[t][0] + dx-1,list[t][1] + dy-1,list[t][2] + dz-1,
				block,
				data,
				mod
			].join(' '),() =>{
				done++;
				this.session.sendCommand(["title", "@s", "actionbar", "§b§\""
					+ done + "/" + list.length, "(" + ((done / list.length).toFixed(2) * 100) + "/100)",
					"", "Speed:", (done / (((new Date()).getTime() - time) / 1000)).toFixed(3) +
					"blocks/s" + "\nTime remaining:",
					((list.length * (((new Date()).getTime() - time)) / done) - ((new Date()).getTime() - time)) / 1000 + "s§\""
				].join(" "));
			});
			t++;
			if(t == list.length){
				this.sendText(now() + profile.generated);
				this.stop = true;
				this.session.clearTable();
				break;
			}
			await asleep(delays);
		}
	}

	/*fillTile(root, list, block, data, mod, delays){
		let that = this;
		let t = 0;
		let interval = setInterval(function () {
			that.session.sendCommand([
				'fill',
				list[t][0], list[t][1], list[t][2],
				list[t][3], list[t][4], list[t][5],
				block,
				data,
				mod
			].join(' '));
			t++;
			if(t == list.length){
				that.sendText(now() + profile.generated);
				clearInterval(interval);
			}
		}, delays);
	}*/

	async setEntity(root, list, entity, delays){
		this.stop = false;
		let t = 0;
		let done = 0,
			time = (new Date()).getTime();
		while(true){
			if(this.stop){
				break;
			}
			this.session.sendCommand([
				'summon',
				entity,
				list[t].join(' ')
			].join(' '),() =>{
				done++;
				this.session.sendCommand(["title", "@s", "actionbar", "§b§\""
					+ done + "/" + list.length, "(" + ((done / list.length).toFixed(2) * 100) + "/100)",
					"", "Speed:", (done / (((new Date()).getTime() - time) / 1000)).toFixed(3) +
					"blocks/s" + "\nTime remaining:",
					((list.length * (((new Date()).getTime() - time)) / done) - ((new Date()).getTime() - time)) / 1000 + "s§\""
				].join(" "));
			});
			t++;
			if(t == list.length){
				this.sendText(now() + profile.generated);
				this.stop = true;
				break;
			}
			await asleep(delays);
		}
	}

	async setLongEntity(root, list, len, direction, entity, delays){
		//It does not work.But I don't want to fix it.
		let t = 0;
		let that = this;
		let dx = direction == 'x' ? len : 1;
		let dy = direction == 'y' ? len : 1;
		let dz = direction == 'z' ? len : 1;
		let interval = setInterval(() => {
			that.session.sendCommand([
				'summon',
				entity,
				list[t].join(' ')
			].join(' '));
			t++;
			if(t == list.length){
				that.sendText(now() + profile.generated);
				clearInterval(interval);
			}
		}, delays);
	}

	tryEval(code){
		let r;
		try{
			r = eval(code);
		}catch (e) {
			r = e;
		}
		return r;
	}
}

function onPlayerMessage(body){
	let properties = body.properties;
	if (properties.MessageType != 'chat' || !$on) return;
	$on = false;
	let $t = setTimeout(()=> {
		$on = true;
	}, 10);
	this.onChatMessage(properties.Message, properties.Sender, properties);
}

function now(){
	let date = new Date();
	return ['[',date.toTimeString().slice(0, 8),']'].join('');
}
module.exports = BuildSession;
