const fs=require("fs");
const http=require("http");
const https=require("https");
const path=require("path");
const AdmZip=require("adm-zip");
const argv=process.argv;
let pkglistwrite;
let pkglist;

process.on("uncaughtException",(e)=>{
	console.log("fpkg FATAL:%s",e);
	process.exit(15);
});


function chkacJSON(name){
	if(!fs.existsSync(name))fs.writeFileSync(name,"[]");
}
chkacJSON("packages/pkglist.json");
chkacJSON("fpkg/pkglist.json");
chkacJSON("fpkg/sources.json");

function get_json_content(url){
	return new Promise((cb,rj)=>{
		const web=(url.split(":")[0]=="http")?http:https;
		web.get(url,(result)=>{
			if(result.statusCode!==200){result.resume();rj(new Error("Response code is "+result.statusCode+"."));return;}
			let data="";
			result.on("data",(chk)=>{data+=chk});
			result.on("end",()=>{
				let jsonp;
				try{jsonp=JSON.parse(data);}catch(e){rj(new TypeError("Unable to parse"));}
				cb(jsonp);
			});
		});
	});
}

function get_file(url){
	return new Promise((cb,rej)=>{
		const web=(url.split(":")[0]=="http")?http:https;
		web.get(url,(result)=>{
			if(result.statusCode!==200){result.resume();rej(new Error("Response code is "+result.statusCode+"."));}
			let data=[];
			let downloaded=0;
			result.on("data",(chk)=>{data.push(chk);downloaded+=chk.length;
			process.stdout.write("Downloading... "+(downloaded/1024).toFixed(2)+"KB/"+(result.headers["content-length"]/1024).toFixed(2)+"KB        \r");
			});
			result.on("end",()=>{
				console.log();
				cb(Buffer.concat(data));
			});
		});
	});
}

async function update(){
	console.log("Refreshing sources...");
	let sources=JSON.parse(fs.readFileSync("fpkg/sources.json"));
	let pkglist=[];
	for(let i in sources){
		try{
			let json=await get_json_content(sources[i]+"/packages.json");
			console.log("GET: "+sources[i]);
			for(let j of json){
				let ji=j;
				ji.url=sources[i]+j.url;
				pkglist.push(ji);
			}
		}catch(err){
			if(err){
				console.log("Error when trying to get pkglist of source:"+sources[i]);
				return false;
			}
		}
	}
	console.log("Downloadable packages count: %d.",pkglist.length);
	fs.writeFileSync("fpkg/pkglist.json",JSON.stringify(pkglist));
	return true;
}

function mountPKGL(){
	try{pkglistwrite=JSON.parse(fs.readFileSync("packages/pkglist.json"));}catch(e){pkglistwrite=[];}
}

function mountPKG(){
	try{pkglist=JSON.parse(fs.readFileSync("fpkg/pkglist.json"));}catch(e){pkglist=[];}
}

function findPKGW(name){
	for(let i in pkglistwrite){
		if(pkglistwrite[i].name==name)return i;
	}
	return -1;
}

async function install(pkg){
	console.log("Locating %s...",pkg);
	let pkginfo=findPKG(pkg);
	if(pkginfo.name=="ENFOUND"){
		console.log("Error:Package not found:%s",pkg);
		return false;
	}
	process.stdout.write("Loading Depends of "+pkginfo.name+"...");
	if(!pkglistwrite)mountPKGL();
	if(pkginfo.depends.length!=0){console.log("%d.",pkginfo.depends.length);}else{
		console.log("No depends.");}
	for(let i of pkginfo.depends){
		if(findPKGW(i)!=-1)continue;
		if(!await install(i)){
			console.log("FATAL:Unable to install depend:"+i+".");
			return false;
			//process.exit(18);
		}
	}
	console.log("Downloading %s...",pkg);
	try{
		let data=await get_file(pkginfo.url);
		try{fs.mkdirSync("packages/"+pkginfo.name);}catch(e){}
		fs.writeFileSync("fpkg/"+pkginfo.name+"-cache-"+pkginfo.name+".fpkgc",data,"binary");
	}catch(err){
		console.log("FATAL:Unable to download package:"+pkginfo.name+"\nTry to fpkg update?");
		return false;
	}
	let zfl=new AdmZip("fpkg/"+pkginfo.name+"-cache-"+pkginfo.name+".fpkgc");
	zfl.extractAllTo("packages/"+pkginfo.name,true);
	fs.unlinkSync("fpkg/"+pkginfo.name+"-cache-"+pkginfo.name+".fpkgc");
	let id=findPKGW(pkg);
	if(id==-1){
		pkglistwrite.push({name:pkginfo.name,version:pkginfo.version,path:pkginfo.name+"/main.js",type:pkginfo.type,depends:pkginfo.depends});
	}else{
		pkglistwrite[id]={name:pkginfo.name,version:pkginfo.version,path:pkginfo.name+"/main.js",type:pkginfo.type,depends:pkginfo.depends};
	}
	console.log("Package %s installed.",pkginfo.name);
	if(!pkglistwrite){return false;}
	fs.writeFileSync("packages/pkglist.json",JSON.stringify(pkglistwrite));
	return true;
}

function rmdir(dir, callback) {
	fs.readdir(dir, (err, files) => {
		if(err)callback();
		function next(index) {
			if (index == files.length) return fs.rmdir(dir, callback)
			let newPath = path.join(dir, files[index])

			fs.stat(newPath, (err, stat) => {
				if (stat.isDirectory() ) {
					rmdir(newPath, () => next(index+1))
				} else {
					fs.unlink(newPath, () => next(index+1))
				}
			})
		}
		next(0)
	});
}

function rmdirSync(dir){
	return new Promise((ok)=>{
		rmdir(dir,ok);
	});
}

function findPKG(name){
	let pkglist=JSON.parse(fs.readFileSync("fpkg/pkglist.json"));
	let inn;
	for(let i of pkglist){
		if(i.name==name&&!inn){
			inn=i;
		}
		if(i.name==name&&inn){
			if(inn.version<i.version){
				inn=i;}
		}
	}
	if(inn)return inn;
	return {name:"ENFOUND",version:[0,0,0]};
}

async function removepkg(pkg,isroot){
	if(!pkglistwrite)mountPKGL();
	let id=findPKGW(pkg);
	if(id==-1){
		console.log("Package %s is not currently installed.",argv[3]);
		process.exit(0);
	}
	for(let i of pkglistwrite){
		for(let j of i.depends){
			if(j==pkglistwrite[id].name)await removepkg(i.name,true);
		}
	}
	id=findPKGW(pkg);
	pkglistwrite.splice(id,1);
	await rmdirSync("packages/"+pkg);
	console.log("Removed package %s.",pkg);
	fs.writeFileSync("packages/pkglist.json",JSON.stringify(pkglistwrite));
}

if(argv[2]=="update"){
	update();
}

else if(argv[2]=="upgrade"){
	async function upgr(){
		if(!await update()){console.log("Update failed.");return false;}
		let pkglistI=JSON.parse(fs.readFileSync("packages/pkglist.json"));
		let pkglist=JSON.parse(fs.readFileSync("fpkg/pkglist.json"));
		for(let i of pkglistI){
			let pkg=findPKG(i.name);
			if(pkg.name=="ENFOUND")continue;
			if(i.version<pkg.version){
				if(!await install(pkg.name)){console.log("Upgrade Failed:\nUnable to install %s.",pkg.name);return false;}
			}
		}
		if(!pkglistwrite){
			console.log("No package upgradable.");
			return true;
		}
		//fs.writeFileSync("packages/pkglist.json",JSON.stringify(pkglistwrite));
		return true;
	}
	upgr();
}

else if(argv[2]=="install"){
	install(argv[3]);
}

else if(argv[2]=="installpkg"){
	if(!argv[3])process.exit(19);
	async function okip(){
		let zfl=new AdmZip(argv[3]);
		zfl.extractEntryTo("pkg.json","fpkg/",true);
		let ths=JSON.parse(fs.readFileSync("fpkg/pkg.json"));
		fs.unlinkSync("fpkg/pkg.json");
		let id=findPKGW(ths.name);
		if(id!=-1){
			if(pkglistwrite[id].version>ths.version){
				console.log("You are trying to downgrade package:%s,%d.%d.%d\nTo:%d.%d.%d.\nAborted.",ths.name,pkglistwrite[id].version[0],pkglistwrite[id].version[1],pkglistwrite[id].version[2],ths.version[0],ths.version[1],ths.version[2]);
				process.exit(20);
			}
		}
		if(ths.depends===undefined||ths.name===undefined||ths.version===undefined){
			console.log("FATAL: Cricital Information Not found!");
			process.exit(21);
		}
		if(ths.description===undefined)console.log("WARN: No description");
		mountPKGL();
		for(let i of ths.depends){
			if(findPKGW(i)!=-1)continue;
			if(!await install(i)){
				console.log("FATAL:Unable to install package depends.");
				process.exit(18);
			}
		}
		try{fs.mkdirSync("packages/"+ths.name);}catch(e){}
		zfl.extractAllTo("packages/"+ths.name,true);
		let pkginfo=ths;
		if(id==-1){
			pkglistwrite.push({name:pkginfo.name,version:pkginfo.version,path:pkginfo.name+"/main.js",type:pkginfo.type,depends:pkginfo.depends});
		}else{
			pkglistwrite[id]={name:pkginfo.name,version:pkginfo.version,path:pkginfo.name+"/main.js",type:pkginfo.type,depends:pkginfo.depends};
		}
		console.log("Package %s installed[manually,fpkg].",ths.name);
		if(!pkglistwrite){process.exit(3);}
		fs.writeFileSync("packages/pkglist.json",JSON.stringify(pkglistwrite));
		process.exit(0);
	}
	okip();
}

else if(argv[2]=="remove"){
	removepkg(argv[3],true);
}

else if(argv[2]=="removeall"){
	mountPKGL();
	async function ad(){
		for(let i of pkglistwrite){
			await removepkg(i.name);
		}
	}
	ad();
}

else if(argv[2]=="list"){
	mountPKG();
	mountPKGL();
	let loadedlist=[];
	for(let i of pkglist){
		if(findPKGW(i.name)!=-1){
			console.log("%s@%d.%d.%d,type:%s\t%s\t[installed]",i.name,i.version[0],i.version[1],i.version[2],i.type,i.description);
		}else{
			console.log("%s@%d.%d.%d,type:%s\t%s",i.name,i.version[0],i.version[1],i.version[2],i.type,i.description);
		}
		loadedlist.push(i.name);
	}
	for(let i of pkglistwrite){
		if(loadedlist.indexOf(i.name)==-1)console.log("%s@%d.%d.%d,type:%s\t[installed,nosource]",i.name,i.version[0],i.version[1],i.version[2],i.type);
	}
}

else{
	console.log("FPKG Package Manager v0.1~b2\n");
	console.log("\tinstall <package name>:install a package with specified name.");
	console.log("\tremove <package name>:remove a package with specified name.");
	console.log("\tupgrade:upgrade all packages.");
	console.log("\tupdate:update source list.");
	console.log("\tremoveall:remove all packages.");
	console.log("\tlist:show installable&installed packages list.");
	console.log("\tinstallpkg:install a (.fpkg) package file.\n");
	console.log("FPKG Processor of pacKaGe");
}
