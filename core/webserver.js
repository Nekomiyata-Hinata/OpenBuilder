const http=require("http");
const fs=require("fs");
const spawn=require("child_process").spawn;
let confs={};

function callMe(thing,value){
	confs[thing]=value;
}

function showHome(res){
	res.write("<html>");
	res.write("<head>");
	res.write("<title>OpenBuilder WebConsole</title>");
	res.write("<link rel=\"stylesheet\" href=\"/depends/bootstrap.min.css\" />");
	res.write("<script src='/depends/jquery.min.js'></script>");
	res.write("<script src='/depends/popper.min.js'></script>");
	res.write("<script src='/depends/bootstrap.min.js'></script>");
	res.write(fs.readFileSync("core/assets/modal.html"));
	res.write("</head>");
	res.write("<body>");
	res.write("<nav class=\"navbar navbar-expand-lg navbar-light bg-light\">");
	res.write("<a class=\"navbar-brand\">OpenBuilder</a>");
	res.write("<div class=\"collapse navbar-collapse\" id=\"navbarSupportedContent\">");
	res.write("<ul class='navbar-nav mr-auto'>");
	res.write("<li class='nav-item dropdown active'>");
	res.write("<a class='nav-link dropdown-toggle' id='systemDD' href='#' role=\"button\" data-toggle=\"dropdown\" aria-haspopup=\"true\" aria-expanded=\"false\">System</a>");
	res.write("<div class='dropdown-menu' aria-labelledby='systemDD'>");
	res.write("<a class='dropdown-item' href='/system/act/stop.oba'>Stop</a>");
	res.write("</div>");
	res.write("</li>");
	res.write("</div>\n</ul>");
	res.write("</nav>");
	res.write("<main role=\"main\" class=\"col-12 col-md-9 col-xl-8 py-md-3 pl-md-5 bd-content\">");
	res.write("<h2>System Information</h2>");
	res.write("<p>Host: "+confs.host+"</p>");
	res.write("<h2>Installed Packages</h2>");
	res.write("<div class='row pre-scrollable' style='height:250px;'><table class='table'><thead><tr><th scope='col'>Name</th><th scope='col'>Version</th><th scope='col'>Type</th><th scope='col'>Action</th></tr></thead><tbody>");
	const plinfo=JSON.parse(fs.readFileSync("packages/pkglist.json"));
	for(let i of plinfo){
		let type;
		if(i.type=="ob")type="OpenBuilder Package";
		if(i.type=="fb")type="FastBuilder Script";
		res.write("<tr><th scope='row'>"+i.name+"</th><td>"+i.version[0]+"."+i.version[1]+"."+i.version[2]+"</td><td>"+type+"</td><td><button class='btn btn-danger removebtn' id='rm"+i.name+"'>Remove</button></td></tr>");
	}
	res.write("</tbody></table></div>");
	res.write("<div class='row'>");
	res.write("<b class='col-lg-3'>Install Package:</b>");
	res.write("<input type=\"text\" class='form-control col-lg-4' id='installPKGI'/>");
	res.write("<a class='col-sm-1'></a>");
	res.write("<button class='btn btn-primary installPKGBTN'>Install</button>");
	res.write("</div>");
	/*res.write("<h2>Packet List</h2>");
	res.write("<div class='row pre-scrollable' style='height:250px;'><table class='table'><thead><tr><th scope='col'>Command</th></tr></thead><tbody class='tbodypklist'>");
	res.write("</tbody></table></div>");*/
	res.write("</main>");
	res.write("<script>");
	res.write(fs.readFileSync("core/assets/main.js"));
	res.write("</script>");
}

const server=http.createServer((req,res)=>{
	res.setHeader("Server","OpenBuilder");
	res.setHeader("Content-Type","charset=UTF-8");
	let url=require('url').parse(req.url,true);
	switch(url.pathname){
	case "/depends/bootstrap.min.css":
		res.setHeader("Content-Type",["text/css","charset=utf-8"]);
		res.write(fs.readFileSync("core/assets/bootstrap.min.css"));
		res.end();
		return;
	case "/depends/jquery.min.js":
		res.setHeader("Content-Type",["application/javascript","charset=utf-8"]);
		res.write(fs.readFileSync("core/assets/jquery.min.js"));
		res.end();
		return;
	case "/depends/popper.min.js":
		res.setHeader("Content-Type",["application/javascript","charset=utf-8"]);
		res.write(fs.readFileSync("core/assets/popper.min.js"));
		res.end();
		return;
	case "/depends/bootstrap.min.js":
		res.setHeader("Content-Type",["application/javascript","charset=utf-8"]);
		res.write(fs.readFileSync("core/assets/bootstrap.min.js"));
		res.end();
		return;
	case ("/"||"/index"):
		res.statusCode=302;
		res.setHeader("Location","/index.app");
		res.end();
		return;
	case "/index.app":
		res.setHeader("Content-Type",["text/html","charset=UTF-8"]);
		res.setHeader("Cache-Control","no-store, no-cache, must-revalidate");
		res.setHeader("Pragma","no-cache");
		showHome(res);
		res.write("</body></html>");
		res.end();
		return;
	case "/system/act/stop.oba":
		res.setHeader("Content-Type",["text/html","charset=UTF-8"]);
		res.setHeader("Cache-Control","no-store, no-cache, must-revalidate");
		res.setHeader("Pragma","no-cache");
		let ref=req.headers.referer;
		if(ref===undefined){res.write("<html><script>location.href='/index.app';</script></html>");res.end();return;}
		if(ref.split("/")[ref.split("/").length-1]!="index.app"){res.write("<html><script>location.href='/index.app';</script></html>");res.end();return;}
		res.write("<html><script>location.href='/index.app';</script><body><h1>OpenBuilder Stopped</h1></body></html>");
		res.end();
		setTimeout(()=>{
		console.log("Stopped by webconsole.");
		process.exit(0);},500);
		return;
	case "/system/fpkg/exec":
		let spr=spawn("node",["fpkg",url.query.p1,url.query.p2]);
		confs.fpkgout="";
		spr.stdout.on("data",(data)=>{confs.fpkgout+=data;});
		spr.on("close",(code)=>{confs.fpkgout+="=Process exited=\n(exit code:"+code+")\n";});
		res.write("FPKG Command executed.<br/>Visit /system/fpkg/execStat for result.");
		res.end();
		return;
	case "/system/fpkg/execStat":
		res.write(confs.fpkgout);
		res.end();
		return;
	case "/sysinfo.app/wsserver/table/get":
		res.statusMessage="Try next time";
		res.statusCode=403;
		res.write("Try next time");
		res.end();
		return;
		try{
		for(let i of confs.buildMap.getMT().values()){
			res.write(i+"\n");
		}
		}catch(err){res.write("(No element)");}
		res.end();
		return;
	}
	res.statusCode=404;
	res.statusMessage="No Such Method";
	res.write("<html><h1>Page (or method) not found</h1><br/><a href='/index.app'>Back to homepage?</a><br/><br/>OpenBuilder webserver</html>");
	res.end();
});

server.listen(8091);

module.exports=callMe;