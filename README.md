#Socket.IO remaining io.namespaces.sockets.socket

##depends on
node.js@0.8.21  
socket.io@0.9.16

##How to run

* run command

node cluster.js

* then exec multi terminal 
node emit.js
node emit.js
node emit.js

* then run for graceful restart

node graceful.js  
	
##How to Confirm

In linux.  
ps ax | grep node  
watch the pid
