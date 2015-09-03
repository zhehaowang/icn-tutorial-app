/*
 * Copyright (C) 2014-2015 Regents of the University of California.
 * @author: Zhehao Wang
 * @author: Jeff Thompson <jefft0@remap.ucla.edu>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * A copy of the GNU Lesser General Public License is in the file COPYING.
 */

var ChronoChat = function(screenName, chatroom, hubPrefix, face, keyChain, certificateName, onChatData)
{
  this.screenName = screenName;
  this.chatroom = chatroom;
  this.isRecoverySyncState = true;
  this.face = face;
  this.keyChain = keyChain;
  this.certificateName = certificateName;

  this.chatPrefix = (new Name(hubPrefix)).append(this.chatroom)
    .append(this.getRandomString());

  this.roster = [];
  this.msgCache = [];
  
  this.maxmsgCacheLength = 100;
  this.syncLifetime = 5000.0;
  this.timeoutInterestLifetime = 60000;

  //console.log("The local chat prefix " + this.chatPrefix.toUri() + " ***");
  
  // NOTE: remind me the usage of session?
  var session = (new Date()).getTime();
  session = parseInt(session/1000);

  this.username = this.screenName + session;

  if (this.screenName == "" || this.chatroom == "") {
    console.log("input username and chatroom");
  }
  else {
    this.sync = new ChronoSync2013
      (this.sendInterest.bind(this), this.initial.bind(this), this.chatPrefix,
       (new Name("/ndn/broadcast/ChronoChat-0.3")).append(this.chatroom), session,
        face, keyChain, certificateName, this.syncLifetime,
        this.onRegisterFailed.bind(this));
    face.registerPrefix
      (this.chatPrefix, this.onInterest.bind(this),
       this.onRegisterFailed.bind(this));
  }

  // UI callbacks
  this.onChatData = onChatData;
};

/**
 * Send the data packet which contains the user's message
 * @param {Name} Interest name prefix
 * @param {Interest} The interest
 * @param {Face} The face
 * @param {number} interestFilterId
 * @param {InterestFilter} filter
 */
ChronoChat.prototype.onInterest = function
  (prefix, interest, face, interestFilterId, filter)
{
  var content = {};

  // chatPrefix should really be saved as a name, not a URI string.
  var chatPrefixSize = new Name(this.chatPrefix).size();
  var seq = parseInt(interest.getName().get(chatPrefixSize + 1).toEscapedString());
  for (var i = this.msgCache.length - 1 ; i >= 0; i--) {
    if (this.msgCache[i].seqNo == seq) {
      var data = new Data(interest.getName());
      data.setContent(this.msgCache[i].encode());

      this.keyChain.sign(data, this.certificateName);
      try {
        face.putData(data);
      }
      catch (e) {
        console.log(e.toString());
      }
      break;
    }
  }
};

ChronoChat.prototype.onRegisterFailed = function(prefix)
{
};

ChronoChat.prototype.initial = function()
{
  var timeout = new Interest(new Name("/timeout"));
  timeout.setInterestLifetimeMilliseconds(this.timeoutInterestLifetime);

  this.face.expressInterest(timeout, this.dummyOnData, this.heartbeat.bind(this));

  if (this.roster.indexOf(this.username) == -1) {
    this.roster.push(this.username);

/*
    document.getElementById('menu').innerHTML = '<p><b>Member</b></p>';
    document.getElementById('menu').innerHTML += '<ul><li>' + this.screenName +
      '</li></ul>';
*/
    var date = new Date();
    document.getElementById('chatDislpayDiv').innerHTML += '<div><b><grey>' + 
      this.screenName + '-' + date.toLocaleTimeString() +
      ': Join</grey></b><br /></div>'
    var objDiv = document.getElementById("chatDislpayDiv");
    objDiv.scrollTop = objDiv.scrollHeight;

    this.messageCacheAppend('JOIN', 'xxx');
  }
};

/**
 * This onData is passed as onData for timeout interest in initial, which means it
 * should not be called under any circumstances.
 */
ChronoChat.prototype.dummyOnData = function(interest, co)
{
  console.log("*** dummyOndata called, name: " + interest.getName().toUri() + " ***");
};

/**
 * Send a Chat interest to fetch chat messages after the user gets the Sync data packet
 * @param {SyncStates[]} The array of sync states
 * @param {bool} if it's in recovery state
 */
ChronoChat.prototype.sendInterest = function(syncStates, isRecovery)
{
  this.isRecoverySyncState = isRecovery;

  var sendList = [];       // of String
  var sessionNoList = [];  // of number
  var sequenceNoList = []; // of number

  for (var j = 0; j < syncStates.length; j++) {
    var syncState = syncStates[j];
    var nameComponents = new Name(syncState.getDataPrefix());
    var tempName = nameComponents.get(-1).toEscapedString();
    var sessionNo = syncState.getSessionNo();
    if (tempName != this.screenName) {
      var index = -1;
      for (var k = 0; k < sendList.length; ++k) {
        if (sendList[k] == syncState.getDataPrefix()) {
          index = k;
          break;
        }
      }
      if (index != -1) {
        sessionNoList[index] = sessionNo;
        sequenceNoList[index] = syncState.getSequenceNo();
      }
      else {
        sendList.push(syncState.getDataPrefix());
        sessionNoList.push(sessionNo);
        sequenceNoList.push(syncState.getSequenceNo());
      }
    }
  }
  
  for (var i = 0; i < sendList.length; ++i) {
    var uri = sendList[i] + "/" + sessionNoList[i] + "/" + sequenceNoList[i];
    var interest = new Interest(new Name(uri));
    interest.setInterestLifetimeMilliseconds(this.syncLifetime);
    this.face.expressInterest(interest, this.onData.bind(this), this.chatTimeout.bind(this));
  }
};

/**
 * Process the incoming data
 * @param {Interest} interest
 * @param {Data} data
 */

// TODO: find out about the 120000, use UI callback instead of modifying UI here
ChronoChat.prototype.onData = function(interest, data)
{
  var content = new ChronoChat.ChatMessage(data.getContent().buf().toString('binary'));
  console.log(content);

  var temp = (new Date()).getTime();
  if (temp - content.timestamp * 1000 < 120000) {
    var time = (new Date(content.timestamp * 1000)).toLocaleTimeString();
    var name = content.from;

    // chatPrefix should be saved as a name, not a URI string.
    var prefix = data.getName().getPrefix(-2).toUri();

    var session = parseInt((data.getName().get(-2)).toEscapedString());
    var seqNo = parseInt((data.getName().get(-1)).toEscapedString());
    var l = 0;

    //update roster
    while (l < this.roster.length) {
      var name_t = this.roster[l].substring(0,this.roster[l].length-10);
      var session_t = this.roster[l].substring(this.roster[l].length-10,this.roster[l].length);
      if (name != name_t && content.msgType != "LEAVE")
        l++;
      else{
        if(name == name_t && session > session_t){
          this.roster[l] = name + session;
        }
        break;
      }
    }

    if(l == this.roster.length) {
      this.roster.push(name + session);

      document.getElementById('chatDislpayDiv').innerHTML += '<div><b><grey>' + name + '-' +
        time + ': Join' + '</grey></b><br /></div>';
      var objDiv = document.getElementById("chatDislpayDiv");
      objDiv.scrollTop = objDiv.scrollHeight;

      /*
      document.getElementById('menu').innerHTML = '<p><b>Member</b></p><ul>';
      for (var i = 0; i < this.roster.length ; i++) {
        var name_t = this.roster[i].substring(0,this.roster[i].length - 10);
        document.getElementById('menu').innerHTML += '<li>' + name_t + '</li>';
      }
      document.getElementById('menu').innerHTML += '</ul>';
      */
    }
    var timeout = new Interest(new Name("/timeout"));
    timeout.setInterestLifetimeMilliseconds(120000);
    this.face.expressInterest(timeout, this.dummyOnData, this.alive.bind(this, timeout, seqNo, name, session, prefix));
    
    //if (content.msgType == 0 && this.isRecoverySyncState == false && content.from != this.screenName){
      // Note: the original logic does not display old data;
      // But what if an ordinary application data interest gets answered after entering recovery state?
    if (content.msgType == "CHAT" && content.from != this.screenName){
      // Display on the screen will not display old data.
      // Encode special html characters to avoid script injection.

      var escaped_msg = $('<div/>').text(content.data).html();
      document.getElementById("chatDislpayDiv").innerHTML +='<p><grey>' + content.from + '-' +
        time + ':</grey><br />' + escaped_msg + '</p>';
      var objDiv = document.getElementById("chatDislpayDiv");
      objDiv.scrollTop = objDiv.scrollHeight;
    } else if (content.msgType == "LEAVE") {
      //leave message
      var n = this.roster.indexOf(name + session);
      if(n != -1 && name != this.screenName) {
        this.roster.splice(n,1);
        /*
        document.getElementById('menu').innerHTML = '<p><b>Member</b></p><ul>';
        for(var i = 0; i<this.roster.length; i++) {
          var name_t = this.roster[i].substring(0,this.roster[i].length - 10);
          document.getElementById('menu').innerHTML += '<li>' + name_t + '</li>';
        }

        document.getElementById('menu').innerHTML += '</ul>';
        */
        var date = new Date(content.timestamp * 1000);
        var time = date.toLocaleTimeString();

        document.getElementById('chatDislpayDiv').innerHTML += '<div><b><grey>' + name +
          '-' + time + ': Leave</grey></b><br /></div>';
        var objDiv = document.getElementById("chatDislpayDiv");
        objDiv.scrollTop = objDiv.scrollHeight;
      }
    }
  }
};

/**
 * No chat data coming back.
 * @param {Interest}
 */
ChronoChat.prototype.chatTimeout = function(interest)
{
  console.log("Timeout waiting for chat data");
};

ChronoChat.prototype.heartbeat = function(interest)
{
  // Based on ndn-cpp library approach
  if (this.msgCache.length == 0) {
    // Is it possible that this gets executed?
    this.messageCacheAppend("JOIN", "xxx");
  }
  this.sync.publishNextSequenceNo();
  this.messageCacheAppend("HELLO", "xxx");

  // Making a timeout interest for heartbeat...
  var timeout = new Interest(new Name("/timeout"));
  timeout.setInterestLifetimeMilliseconds(this.timeoutInterestLifetime);

  //console.log("*** Chat heartbeat expressed interest with name: " + timeout.getName().toUri() + " ***");
  this.face.expressInterest(timeout, this.dummyOnData, this.heartbeat.bind(this));
};

/**
 * This is called after a timeout to check if the user with prefix has a newer sequence
 * number than the given temp_seq. If not, assume the user is idle and remove from the
 * roster and print a leave message.
 * This method has an interest argument because we use it as the onTimeout for
 * Face.expressInterest.
 * @param {Interest}
 * @param {int}
 * @param {string}
 * @param {int}
 * @param {string}
 */
ChronoChat.prototype.alive = function(interest, temp_seq, name, session, prefix)
{
  //console.log("check alive");
  var index_n = this.sync.digest_tree.find(prefix, session);
  var n = this.roster.indexOf(name + session);

  if (index_n != -1 && n != -1) {
    var seq = this.sync.digest_tree.digestnode[index_n].seqNo_seq;
    if (temp_seq == seq) {
      this.roster.splice(n,1);
      console.log(name+" leave");
      var date = new Date();
      var time = date.toLocaleTimeString();

      document.getElementById('chatDislpayDiv').innerHTML += '<div><b><grey>' + name + '-' +
        t + ': Leave</grey></b><br /></div>';
      var objDiv = document.getElementById("chatDislpayDiv");
      objDiv.scrollTop = objDiv.scrollHeight;
/*
      document.getElementById('menu').innerHTML = '<p><b>Member</b></p><ul>';
      for (var i = 0; i < this.roster.length; i++) {
        var name_t = this.roster[i].substring(0, this.roster[i].length - 10);
        document.getElementById('menu').innerHTML += '<li>' + name_t + '</li>';
      }
      document.getElementById('menu').innerHTML += '</ul>';
*/
    }
  }
};

ChronoChat.prototype.sendMessage = function(chatMsg)
{
  // NOTE: check if this check should be here
  if (this.msgCache.length == 0)
    this.messageCacheAppend("JOIN", "xxx");
      
  this.sync.publishNextSequenceNo();
  this.messageCacheAppend("CHAT", chatMsg);
}

/**
 * Send the leave message and leave.
 */
ChronoChat.prototype.leave = function()
{
  this.sync.publishNextSequenceNo();
  this.messageCacheAppend("LEAVE", "xxx");
};

/**
 * Append a new ChatMessage to msgCache, using given messageType and message,
 * the sequence number from this.sync.getSequenceNo() and the current time.
 * Also remove elements from the front of the cache as needed to keep the size to
 * this.maxmsgCacheLength.
 */
ChronoChat.prototype.messageCacheAppend = function(messageType, message)
{
  var date = new Date();
  var time = date.getTime();

  this.msgCache.push(new ChronoChat.ChatMessage(this.sync.getSequenceNo(), this.screenName, messageType, message, time));
  while (this.msgCache.length > this.maxmsgCacheLength) {
    this.msgCache.shift();
  }
};

ChronoChat.prototype.getRandomString = function()
{
  var seed = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM0123456789';
  var result = '';
  for (var i = 0; i < 10; i++) {
    var pos = Math.floor(Math.random() * seed.length);
    result += seed[pos];
  }
  return result;
};

ChronoChat.ChatMessage = function(seqNoOrChatMessageOrEncoding, from, msgType, msg, timestamp)
{
  if (typeof seqNoOrChatMessageOrEncoding === 'object' && seqNoOrChatMessageOrEncoding instanceof ChronoChat.ChatMessage) {
    // Copy constructor
    var chatMessage = seqNoOrChatMessageOrEncoding;

    this.seqNo = chatMessage.seqNo;
    this.from = chatMessage.from;
    this.msgType = chatMessage.msgType;
    this.timestamp = chatMessage.timestamp;
    this.data = chatMessage.data;
    
    // TODO: find if "to" could be useful in any cases?
    this.to = "";
  } else if (typeof seqNoOrChatMessageOrEncoding === 'string') {
    // Decode from encoding constructor
    var encoding = ChronoChat.ChatMessage.decode(seqNoOrChatMessageOrEncoding);
    
    this.seqNo = encoding.seqNo;
    this.from = encoding.from;
    this.msgType = encoding.msgType;
    this.timestamp = encoding.timestamp;
    this.data = encoding.data;
    
    this.to = "";
  } else {
    // Value assignment constructor
    var seqNo = seqNoOrChatMessageOrEncoding;

    this.seqNo = seqNo;
    this.from = from;
    this.msgType = msgType;
    this.timestamp = timestamp;
    this.data = msg;

    this.to = "";
  }
};

ChronoChat.ChatMessage.prototype.encode = function()
{
  return JSON.stringify(this);
};

ChronoChat.ChatMessage.decode = function(encoding)
{
  return JSON.parse(encoding);
};

function getRandomNameString()
{
  var seed = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM';
  var result = '';
  for (var i = 0; i < 3; i++) {
    var pos = Math.floor(Math.random() * seed.length);
    result += seed[pos];
  }
  return result;
};