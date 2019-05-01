function refRStat(){
$.get("/system/fpkg/execStat",(data)=>{
if(data.indexOf("(exit code:")!=-1){
$("#modalTitle").text("Operation Done");
$("#modalContent").text(data);
$(".mokb").css("display","");
}else{
$("#modalContent").text(data);
setTimeout("refRStat()",50);
}
});
}

function execCMD(a,b){
$(".mokb").css("display","none");
$("#modalTitle").text("Executing command...");
//$("#modalContent").text();
$("#popModal").modal({keyboard:!1,backdrop:"static"});
$.get("/system/fpkg/exec?p1="+a+"&p2="+b);
refRStat();
}

$(".removebtn").click((el)=>{
if(!confirm("Are you sure?\nThis action can't undo!"))return;
let eid=el.target.id.slice(2);
execCMD("remove",eid);
});

$(".installPKGBTN").click(()=>{
execCMD("install",$("#installPKGI").val());
});