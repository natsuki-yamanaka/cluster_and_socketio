//-------------------------------------------------------//
//socket.ioテスト用シェル
//-------------------------------------------------------//
var util = require('util');
var event = 'login';

var data = {
	count: 1
};

//-------------------------------------------------------//
//socket.ioへのイベント送信クライアント
var io = require('socket.io-client');
//socket.ioに接続
var host = 'http://localhost';
var port = 20082;
if(isFinite(process.argv[3])){
	port = process.argv[3] ;
}

var socket = io.connect(host+':'+port);
//-------------------------------------------------------//
//データ送信
socket.emit(event, data);

var timeout;
var my_session_id;
//-------------------------------------------------------//
//イベント受信
console.log('socket.emit = '+util.inspect(data,false,null));
socket.on('connect', function(){
	console.log('socket connect = ');
	//受信イベント
	socket.on('message',function(msg){
		//PHPから戻ってくる
		console.log('eventOn message msg = '+util.inspect(msg,false,null));
	});
	socket.on('logined',function(msg){
		console.log('eventOn logined msg = '+util.inspect(msg,false,null));
		//自分の送ったイベントだったらもう一度送信する
		if(my_session_id != msg['your_session_id']){
			if(!my_session_id){
				my_session_id = msg['your_session_id'] ;
				timeout = setTimeout(function(){
					console.log('loadedFriendOrderByFavor send. ');
					data['count']++;
					socket.emit(event, data);
				},1000);
			}
		}else{
			timeout = setTimeout(function(){
				console.log('loadedFriendOrderByFavor send. ');
				data['count']++;
				socket.emit(event, data);
			},1000);
		}
	});
	socket.on('error',function(msg){
		console.log('eventOn error msg = '+util.inspect(msg,false,null));
	});
	socket.on('disconnect',function(msg){
		console.log('eventOn disconnect msg = '+util.inspect(msg,false,null));
		//リピートリセット
		if(timeout){
			try{
				clearTimeout(timeout);
			}catch(e){
			}
		}
	});
});
