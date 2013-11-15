//----------------------------------------------------------------------------------------
//js for hot deploy.

//command like
//node this-js exec-js argv

var cluster = require('cluster');
var http = require('http');
var exec_js = 'janken.js';
var workers = [];
var workerNum = 2;
var restarter_id = 0;

//起動時ワーカーを立ち上げる
clusterFork();

// reload用http
var server = http.createServer(function (req, res) {
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end('Hello World\n');
	
	//ワーカー再起動処理
	if(req.url.match(new RegExp("^/reload"))
	&& req.client.remoteAddress == '127.0.0.1'){
		console.log('restarter_id ' + restarter_id+' workers.length '+(workers.length-1));
		clusterForkOneProcess();
		for (var i = 0; i < workerNum;i++){
			workerDisconnect(restarter_id,function(){
				console.log('Disconnect -----------------------------	' + process.pid);
				clusterForkOneProcess();
			});
		}
	}
}).listen(1337, 'localhost');


cluster.on('exit', function(worker, code, signal) {
	console.log('cluster exit.');
});


//初期ワーカーを立ち上げ
function clusterFork(){
	if (cluster.isMaster) {
		console.log('isMaster ' + process.pid);
		cluster.setupMaster({
			exec: exec_js
			, args: process.argv
			, silent: false
		});
		// マスタ
		for (var i = 0; i < workerNum; i++) {
			console.log('cluster.fork ' + 1);
			var worker = cluster.fork(); // ワーカを起動
			workers.push(worker);
		}
	}
}

//ワーカーを一個立ち上げ
function clusterForkOneProcess(){
	if (cluster.isMaster) {
		// マスタ
		console.log('isMaster ' + process.pid);
		var worker = cluster.fork(); // ワーカを起動
		workers.push(worker);
		console.log('cluster.fork now workers.length = ' + workers.length);
	}
}

//今生きているワーカーをkill
function workerDisconnect(i, callback){
	restarter_id++;
	console.log('workerDisconnect. '+i);
	var disconnect_worker = workers[i];
	disconnect_worker.disconnect();
	disconnect_worker.on('disconnect', function() {
		//workerオブジェクトをdisconnectだけだとプロセスが死んでくれないので、強制kill
		disconnect_worker.process.kill();
		for (var num = 0; num < workers.length; num++) {
			if(workers[num] == disconnect_worker){
				workers.splice(num,1);
				console.log('splice worker:'+num);
			}
		}
		restarter_id--;
		console.log('workerDisconnect. workers.length - '+workers.length+' -----------------------------');
		//一応ワーカーが少なければ再フォーク処理
		if(workers.length < workerNum){
			callback();
		}
	});
}
