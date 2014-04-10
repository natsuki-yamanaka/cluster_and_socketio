//----------------------------------------------------------------------------------------
//js for hot deploy.

//command like
//node this-js exec-js argv

var cluster = require('cluster');
var http = require('http');
var tag = '[cluster]';
var exec_js = 'janken.js';


var workers = [];
//default listening worker
var workerNum = 4;
//default limit
var workerLimit = 10;

var Config = {
    CLUSTER_CONFIG_FILE:'config_cluster.js',
    CHILD_PROCESS_PID_FILE_BASE_NAME:'child_main',
    ERROR_LOG_FILE:'error.log'
};


//config load
try{
    var config_data = fs.readFileSync(Config.CLUSTER_CONFIG_FILE).toString();
    config_data = JSON.parse(config_data);
    if(config_data['workerNum'] && isFinite(config_data['workerNum']) && config_data['workerLimit'] && isFinite(config_data['workerLimit'])){
        workerNum = config_data['workerNum'];
        workerLimit = config_data['workerLimit'];
    }
}catch(e){
    logger(tag,'readFile error '+e,'info');
}

//Environment
var server_option = {};
server_option['sslkey'] = 'key';
server_option['sslcert'] = 'cert';
server_option['sslca'] = 'ca';

//worker start
firstFork();

/**
 * graceful restart
 * see kill -l
 */
process.on('SIGUSR2',function(){
    logger(tag,'got SIGUSR2. workers.length '+workers.length,'info');

    clusterForkProcesses(null, function(new_workers){
        for (var i = 0; i < workers.length;i++){
            workerDisconnect(i,new_workers);
        }
        //ワーカーの数がlimit超えていないかcheck
        if( (workers.length) > workerLimit){
            var SIGUSR1_disconnected_workers = disconnectingWorkerCheck();
            //process kill (break workerNum)
            for(var i = 0; i < workerNum;i++){
                disconnectingWorkerKill(SIGUSR1_disconnected_workers[i]);
                spliceExec(SIGUSR1_disconnected_workers[i]);
            }
        }
    });
});


/**
 * config reload
 */
process.on('SIGUSR1',function(){
    logger(tag,'got SIGUSR1. workers.length '+workers.length,'info');
    //worker config read
    readConfigFile();
});


/**
 * add worker
 */
process.on('SIGCONT',function(){
    logger(tag,'got SIGCONT. workers.length '+workers.length,'info');
    workerNum++;
    clusterForkProcesses(1, function(new_workers){
        //worker num check
        if( (workers.length + workerNum) > workerLimit){
            var SIGUSR1_disconnected_workers = disconnectingWorkerCheck();
            //process kill (break workerNum)
            for(var i = 0; i < workerNum;i++){
                disconnectingWorkerKill(SIGUSR1_disconnected_workers[i]);
                spliceExec(SIGUSR1_disconnected_workers[i]);
            }
        }
    });
});


/**
 * end log
 */
cluster.on('exit', function(worker, code, signal) {
    var pid = worker && worker.process ? worker.process.pid : null ;
    logger(tag,'cluster exit. pid:' +pid+' signal:'+signal+' code:'+code,'info');
});

cluster.on('exit', function(worker, code, signal) {
	console.log('cluster exit.');
});


/**
 * first worker start
 */
function firstFork(){
    if (cluster.isMaster) {
        cluster.setupMaster({
            exec: exec_js
            , args: process.argv
            , silent: false
        });
        // マスタ
        for (var i = 0; i < workerNum; i++) {
            logger(tag,'cluster.fork ' + 1);
            var worker = cluster.fork(server_option); // ワーカを起動
            //pidファイルを生成
            if(worker && worker.process){
                writePidFile(Config.CHILD_PROCESS_PID_FILE_BASE_NAME+(i+1)+'.pid', worker.process.pid);
            }
            workers.push(worker);
        }
    }
}

//one worker fork
function clusterForkProcesses(plusForkNum, callback){
    if (cluster.isMaster) {
        // master

        var new_workers = [];
        var startup_worker_num = 0;
        var forkNum = workerNum;
        if(plusForkNum && isFinite(plusForkNum)){
            forkNum = plusForkNum;
        }
        logger(tag,'clusterForkProcesses forkNum '+forkNum);

        // master
        for (var i = 0; i < forkNum; i++) {
            var new_worker = cluster.fork(server_option); // ワーカを起動
            if(new_worker && new_worker.process){
                writePidFile(Config.CHILD_PROCESS_PID_FILE_BASE_NAME+(i+1)+'.pid', new_worker.process.pid);
            }
            new_workers.push(new_worker);
            new_worker.on('listening', function(worker, address) {
				logger("A worker is now connected to " + new_worker.process.pid);
                startup_worker_num++;
                if(startup_worker_num >=forkNum){
                    if(callback){
                        callback(new_workers);
                    }
                }
            });
            workers.push(new_worker);
			logger(tag,'cluster.fork now workers.length = ' + workers.length,'info');
        }
    }
}

/**
 * stop over flood worker listening
 */
function workerDisconnect(i, new_workers){
//	CommonFunc.logger(tag,'workerDisconnect. '+i,'info');
    var disconnect_worker = workers[i];
    if(disconnect_worker && disconnect_worker.process){
        logger(tag,'workerDisconnect. '+disconnect_worker.process.pid,'info');
    }
    if(disconnect_worker && !disconnect_worker.is_disconnecting && !CommonFunc.contains(new_workers,disconnect_worker)){
        logger(tag,'disconnect pid. '+disconnect_worker.process.pid);
        //stop listening
        disconnect_worker.disconnect();
        disconnect_worker.is_disconnecting = true;

        disconnect_worker.on('disconnect', function() {
            //force kill
            if(disconnect_worker && disconnect_worker.process){
                logger(tag,'workerDisconnect killAndSplice. '+disconnect_worker.process.pid+' workers.length - '+workers.length,'info');
            }
            killAndSplice(disconnect_worker);

            //refork
            if(workers.length < workerNum){
                logger(tag,'after disconnect clusterForkProcesses because length = '+workers.length,'info');
                clusterForkProcesses();
            }
        });
    }else{
        var disconnect_worker_pid = disconnect_worker ? null : disconnect_worker.process.pid;
        logger(tag,'workerDisconnect irregular pattern. disconnect_worker - '+disconnect_worker_pid,'info');
    }
}

/**
 * error handling
 */
process.on('uncaughtException', function (err){
    if(err && err.stack){
        fs.writeFile(Config.ERROR_LOG_FILE, err.stack, function (err) {
            if (err) throw err;
        });
        logger(tag+'uncaughtException',err.stack,'error');
    }else{
        fs.writeFile(Config.ERROR_LOG_FILE, err, function (err) {
            if (err) throw err;
        });
        logger(tag+'uncaughtException',err,'error');
    }
});


/**
 * force kill child processes that disconnected and not die
 */
function killAndSplice(disconnect_worker){
    disconnectingWorkerKill(disconnect_worker);
    spliceExec(disconnect_worker);
}

/**
 * get process Array that disconnected and not diedisconnect
 */
function disconnectingWorkerCheck(){
    var disconnected_workers = [];
    //all worker check
    for (var i = 0; i < workers.length;i++){
        if(workers[i] && workers[i].is_disconnecting){
            if(workers[i]){
                disconnected_workers.push(workers[i]);
            }
        }
    }
    return disconnected_workers;
}

/**
 * call disconnect_worker.process.kill
 */
function disconnectingWorkerKill(disconnect_worker){
    if(disconnect_worker && disconnect_worker.process){
        logger(tag,'kill pid. '+disconnect_worker.process.pid,'info');
        disconnect_worker.process.kill();
        return disconnect_worker;
    }else{
        return;
    }
}

/**
 * call disconnect_worker splice
 */
function spliceExec(disconnect_worker){
    for (var num = 0; num < workers.length; num++) {
        if(workers[num] && disconnect_worker && workers[num] == disconnect_worker){
            if(workers[num]){
                CommonFunc.logger(tag,'splice pid. '+workers[num].process.pid);
            }
            workers.splice(num,1);
        }
    }
}

/**
 * write pid to File
 */
function writePidFile(file, data){
    //pidファイル生成
    if(!Config.is_test_process){
        fs.writeFile(file, data, function (err) {
            if(err){
                logger(tag,file+' write PID '+data,'error');
            }
        });
    }
}

/**
 * read worker config File
 */
function readConfigFile(){
    fs.readFile(Config.CLUSTER_CONFIG_FILE, function (err, data) {
        if(err){
            logger(tag,'err reading '+Config.CLUSTER_CONFIG_FILE+' err:'+err,'info');
        }else{
            logger(tag,'err reading '+Config.CLUSTER_CONFIG_FILE+' data:'+data,'info');
        }
        try{
            data = JSON.parse(data);
        }catch(e){
            logger(tag,'err JSON.parse '+Config.CLUSTER_CONFIG_FILE+' err:'+e,'info');
        }

        if(data['workerNum'] && isFinite(data['workerNum']) && data['workerLimit'] && isFinite(data['workerLimit'])){
            workerNum = data['workerNum'];
            workerLimit = data['workerLimit'];
        }
        logger(tag,'readConfigFile workerNum '+workerNum+' workerLimit '+workerLimit,'info');
    });
}

function logger(msg){
    if(DEBUG){
        console.log(msg);
    }
}