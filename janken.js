// clusterでマルチプロセス + graceful restart

//---------------------------------------------------------------------------------//
//外部モジュール読み込み
var http = require('http');
var fs = require('fs');
var util = require('util');


/**---------------------------------------------------------------------------------//
 * 
 * 定数
 */

var PORT = 20082;
var DOC_ROOT = require('path').dirname(require.main.filename);
var NAMESPACE = 'room1';
var connection = 0;
var disconnected = 0;

//---------------------------------------------------------------------------------//

//生成したHTTPサーバーでsocket.ioをlisten
var io = 		require('socket.io').listen(

	//まずHTTPサーバー生成＆起動
	http.createServer(function(req, res){
		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end("START!");
	//HTTPサーバーをListen
	}).listen( PORT,function(){
		//プロセスをユーザー指定で起動
//		process.setuid(EXEC_PROCESS_USER_UID);
	})
	
);
//---------------------------------------------------------------------------------//
logger("socket.io start:" + PORT );
var user_ids = [];
io.sockets.on('connection', function(socket){
	
	connection++;
	
	//イベント宣言----------------------------------------//
	socket.on('login', 				function(data){login(data)});
	socket.on('disconnect', 		function(data){disconnect(data)});

	//################################################################
	//↓以下イベント登録//---------------------------------------------------------------------------------//
	/** すでにログインしている相手を検索 */
	var login = function(data){
		logger("login:" + util.inspect(data,false,null) );
		var event = 'logined';
		var response = {
			'your_session_id':socket.id,
			'response_code':0,
			'response_message':'test',
			'count':data['count'],
		};
		
		socket.join(NAMESPACE);
		
		//
		io.sockets.to(NAMESPACE).emit(event, response);
	};
	
	//---------------------------------------------------------------------------------//
	/** 切断時 */
	var disconnect = function(data){
		connection--;
		disconnected++;
		var clients_count = 0;
		try{
			clients_count = Object.keys(io.sockets.manager.roomClients).length;
		}catch(e){}
		logger('disconnect:'+socket.id+' connecting:'+(connection-disconnected)+ ' clients_count:' +clients_count);
	};
});

function logger(data){
	console.log(data + ' pid:' + process.pid);
}