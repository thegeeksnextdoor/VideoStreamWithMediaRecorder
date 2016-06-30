
function DataChannel(p2pConnection, socket, peer, sourceBuffer){
	var self = this;
	var dataChannel;
	this.p2pConnection = p2pConnection;
	this.socket = socket;
	this.peer = peer;
	this.sourceBuffer = sourceBuffer;
	this.chunkUpdating = false;
	this.chunks = [];
	this.videoData = [];
	this.chunkSize = 10000;
}

DataChannel.prototype.open = function(){
	var self = this;

	var dataChannelOptions = {
			ordered: true,
			reliable: true,
			negotiated: true,
			id: "myChannel"
	};

	this.dataChannel = this.p2pConnection.createDataChannel("label", dataChannelOptions);

	MessageEnum = {
			OFFER: "offer",
			ANSWER: "answer",
			TIMESTAMP: "timeStamp",
			TIMESTAMPRESPONSE: "timeStampResponse"
	}

	self.dataChannel.onerror = function (error) {
		console.log("Data Channel Error:", error);
	};

	self.dataChannel.onmessage = function (msg) {
		if (isJson(msg.data)){
			message = JSON.parse(msg.data);

			switch(message.type){

			case MessageEnum.OFFER:
				console.log("received offer in datachannel");
				console.log(message);
				self.setupConnection();
				self.onOffer(message);
				break;

			case MessageEnum.ANSWER:
				console.log("received answer in datachannel");
				console.log(message);
				self.onAnswer(message);
				break;

			case MessageEnum.TIMESTAMP:
				console.log("received time stamp");
				self.onTimeStamp(message);
				break;

			case MessageEnum.TIMESTAMPRESPONSE:
				self.onTimeStampResponse(message);
				break;
			}
		} else {
			message = msg.data + "<br />"
			document.getElementById("info").innerHTML += message;
		}
	};

	self.dataChannel.onopen = function () {
		console.log("dataChannel opened");
		self.dataChannel.send("connected.");
		self.socket.emit("dataChannelStatus", {
			type: "dataChannelStatus",
			status: "success"
		});
	};

	self.dataChannel.onclose = function () {
		console.log("The Data Channel is Closed");
	};
}

DataChannel.prototype.send = function(message){
	this.dataChannel.send(message);
}

//receive an spd answer
DataChannel.prototype.onOffer = function(sdpOffer){
	var self = this;
	sdpAnswer = new RTCSessionDescription(sdpOffer);
	this.p2pConnection.setRemoteDescription(sdpOffer, function(){
		self.p2pConnection.createAnswer(function (answer) {
			answer.sdp = answer.sdp.replace(/a=sendrecv/g,"a=recvonly");
			self.p2pConnection.setLocalDescription(answer);
			answer = JSON.stringify(answer);
			self.send(answer);
			console.log(self.p2pConnection.localDescription);
			console.log(self.p2pConnection.remoteDescription);
		},function(error){
			console.log(error);
		});
	}, function(){});
}

//receive an spd answer
DataChannel.prototype.onAnswer = function(sdpAnswer){
	sdpAnswer = new RTCSessionDescription(sdpAnswer);
	this.p2pConnection.setRemoteDescription(sdpAnswer,function(){}, function(){});
	console.log(this.p2pConnection.localDescription);
	console.log(this.p2pConnection.remoteDescription);
}

DataChannel.prototype.onTimeStamp = function(timeStamp){
	var respondTime = Date.now();
	var timeStampResponse = {
			type: "timeStampResponse",
			sendTime: timeStamp.sendTime,
			respondTime: respondTime
	}
	timeStampResponse = JSON.stringify(timeStampResponse);
	this.dataChannel.send(timeStampResponse);
}

DataChannel.prototype.onTimeStampResponse = function(timeStampResponse){
	var self = this;
	receiveTime = Date.now();
	console.log("sendTime is " + message.sendTime);
	console.log("respondTime is " + message.respondTime);
	console.log("receiveTime is " + receiveTime);

	this.socket.emit("timeStamp", {
		type: "timeStamp",
		peer: self.peer,
		sendTime: message.sendTime,
		respondTime: message.respondTime,
		receiveTime: receiveTime
	});
}

DataChannel.prototype.setupConnection = function(){
	var self = this;
	this.p2pConnection.onaddstream = function (e) {
		console.log(e.stream);
		console.log(e.stream.id);
		self.setLocalStream(e.stream);
		self.startRecording(e.stream);
		window.localVideo2.src = window.URL.createObjectURL(e.stream);
	};
}

DataChannel.prototype.startRecording = function(stream) {
	// Could improve performace in the future when disconnect by increase buffer size
	window.sourceBuffer.abort();
	var self = this;
	var mediaRecorder = new MediaRecorder(stream);
//	will freeze if lose socket	
	mediaRecorder.start(200);

	mediaRecorder.ondataavailable = function (e) {
		console.log(window.localVideo.readyState);
		var reader = new FileReader();
		reader.addEventListener("loadend", function () {
			var arr = new Uint8Array(reader.result);
			self.videoData.push(arr);
			if (!window.sourceBuffer.updating){
				var chunk = self.videoData.shift();
				window.sourceBuffer.appendBuffer(chunk);
			}
		});
		reader.readAsArrayBuffer(e.data);
	};

	mediaRecorder.onstart = function(){
		console.log('Started, state = ' + mediaRecorder.state);
	};
}

DataChannel.prototype.setLocalStream = function(stream){
}

function isJson(str) {
	try {
		JSON.parse(str);
	} catch (e) {
		return false;
	}
	return true;
}

module.exports = DataChannel;