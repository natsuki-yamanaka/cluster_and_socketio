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
//-------------------------------------------------------//

console.log('socket.emit = '+util.inspect(data,false,null));
socket.on('connect', function(){
	console.log('socket connect = ');
	socket.on('message',function(msg){
		console.log('eventOn message msg = '+util.inspect(msg,false,null));
	});
	socket.on('logined',function(msg){
		console.log('eventOn logined msg = '+util.inspect(msg,false,null));
	});
	socket.on('error',function(msg){
		console.log('eventOn error msg = '+util.inspect(msg,false,null));
	});
	socket.on('disconnect',function(msg){
		console.log('eventOn disconnect msg = '+util.inspect(msg,false,null));
	});
});
