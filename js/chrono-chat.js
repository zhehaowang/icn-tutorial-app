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

// NOTE: constructor now takes the actual username as a parameter
var ChronoChat = function
   (screenName, username, chatroom, hubPrefix, 
    face, keyChain, certificateName, 
    onChatData, onUserLeave, onUserJoin, updateRoster,
    usePersistentStorage)
{
  this.screenName = screenName;
  this.chatroom = chatroom;
  this.isRecoverySyncState = true;
  this.face = face;
  this.keyChain = keyChain;
  this.certificateName = certificateName;
  
  if (username === undefined) {
    this.username = this.getRandomString();
  } else {
    this.username = username;
  }
  this.chatPrefix = (new Name(hubPrefix)).append(this.chatroom).append(this.username);
  console.log("My chat prefix: " + this.chatPrefix.toUri() + " ; My screen name " + this.screenName);

  this.roster = {};
  this.interestSeqDict = {};

  this.msgCache = [];
  
  this.maxmsgCacheLength = 100;
  this.syncLifetime = 5000;
  this.chatInterestLifetime = 3000;

  this.heartbeatInterval = 10000;
  // NOTE: if the data takes longer than heartbeatInterval to arrive, a leave will be posted; this may not be ideal
  this.checkAliveWaitPeriod = this.heartbeatInterval * 2;
  
  this.chatDataLifetime = 10000;

  // TODO: Checkalive mechanism
  // NOTE: The session number used with the applicationDataPrefix in sync state messages 
  this.session = parseInt((new Date()).getTime()/1000);

  //this.username = this.screenName + session;
  
  this.usePersistentStorage = usePersistentStorage;
  if (this.usePersistentStorage === undefined) {
    this.usePersistentStorage = false;
  }
  if (this.usePersistentStorage) {
    this.chatStorage = new IndexedDbChatStorage("chatdb", this.face);
  }

  if (this.screenName == "" || this.chatroom == "") {
    console.log("input username and chatroom");
  } else {
    this.sync = new ChronoSync2013
      (this.sendInterest.bind(this), this.initial.bind(this), this.chatPrefix,
       (new Name("/ndn/broadcast/ChronoChat-0.3")).append(this.chatroom), this.session,
        face, keyChain, certificateName, this.syncLifetime,
        this.onRegisterFailed.bind(this));

    // NOTE: same face tries to register for the same prefix twice with different callbacks, if this is not put in an if/else
    if (this.usePersistentStorage) {
      this.chatStorage.registerPrefix(this.chatPrefix, this.onRegisterFailed.bind(this), this.onPersistentDataNotFound.bind(this));
    } else {
      face.registerPrefix
        (this.chatPrefix, this.onInterest.bind(this),
         this.onRegisterFailed.bind(this));
    }
  }

  // UI callbacks
  this.onChatData = onChatData;
  this.onUserLeave = onUserLeave;
  this.onUserJoin = onUserJoin;
  this.updateRoster = updateRoster;

  //this.chatStorage.delete();
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
  // chatPrefix should really be saved as a name, not a URI string.
  var chatPrefixSize = new Name(this.chatPrefix).size();
  var seq = parseInt(interest.getName().get(chatPrefixSize + 1).toEscapedString());
  for (var i = this.msgCache.length - 1 ; i >= 0; i--) {
    if (this.msgCache[i].seqNo == seq) {
      var data = new Data(interest.getName());
      data.setContent(this.msgCache[i].encode());
      data.getMetaInfo().setFreshnessPeriod(this.chatDataLifetime);

      this.keyChain.sign(data, this.certificateName);
      try {
        face.putData(data);
      } catch (e) {
        console.log(e.toString());
      }
      break;
    }
  }
};

ChronoChat.prototype.onPersistentDataNotFound = function(prefix, interest, face, interestFilterId, filter)
{
  this.onInterest(prefix, interest, face, interestFilterId, filter);
};

ChronoChat.prototype.onRegisterFailed = function(prefix)
{
  console.log("Register failed for prefix " + prefix.toUri());
};

ChronoChat.prototype.initial = function()
{
  var self = this;
  setTimeout(function () {
    setInterval(self.heartbeat.bind(self), self.heartbeatInterval);
  }, self.heartbeatInterval);
  // Note: alternatively, let user call join, need changes in the library, so that initial interest is not expressed in constructor, but in a "start" function instead

  // Display the persistently stored local messages
  var self = this;
  if (this.usePersistentStorage) {
    this.chatStorage.database.messages.each(function(item, cursor){
      var data = new Data();
      data.wireDecode(new Blob(item.content));
      self.onData(undefined, data);
    }).then(function() {
      self.join();
    });
  } else {
    this.join();
  }
};

/**
 * This onData is passed as onData for timeout interest in initial, which means it
 * should not be called under any circumstances.
 */
ChronoChat.prototype.dummyOnData = function(interest, data)
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

  var sendList = {};

  for (var j = 0; j < syncStates.length; j++) {
    var nameComponents = new Name(syncStates[j].getDataPrefix());
    var tempName = nameComponents.get(-1).toEscapedString();

    if (tempName != this.username) {
      if (syncStates[j].getDataPrefix() in sendList) {
        sendList[syncStates[j].getDataPrefix()].seqNo = syncStates[j].getSequenceNo();
        sendList[syncStates[j].getDataPrefix()].sessionNo = syncStates[j].getSessionNo();
      } else {
        sendList[syncStates[j].getDataPrefix()] = {"seqNo": syncStates[j].getSequenceNo(), "sessionNo": syncStates[j].getSessionNo()};
      }
    }
  }
  
  for (var dataPrefix in sendList) {
    var tempName = new Name(dataPrefix).get(-1).toEscapedString();
    if (!(tempName in this.interestSeqDict) || sendList[dataPrefix].seqNo > this.interestSeqDict[tempName]) {
      var name = (new Name(dataPrefix)).append(sendList[dataPrefix].sessionNo.toString()).append(sendList[dataPrefix].seqNo.toString());
      var interest = new Interest(new Name(name));
      interest.setInterestLifetimeMilliseconds(this.chatInterestLifetime);
      this.face.expressInterest(interest, this.onData.bind(this), this.chatTimeout.bind(this));
      this.interestSeqDict[tempName] = sendList[dataPrefix].seqNo;
    } else {
      this.interestSeqDict[tempName] = sendList[dataPrefix].seqNo;
    }
  }
};

ChronoChat.prototype.onData = function(interest, data)
{
  console.log("Got data: " + data.getName().toUri());

  var content = new ChronoChat.ChatMessage(data.getContent().buf().toString('binary'));
  
  // chatPrefix should be saved as a name, not a URI string.
  var prefix = data.getName().getPrefix(-2).toUri();

  // TODO: This assumes knowledge of how the library would manipulate the name in application code
  var session = parseInt((data.getName().get(-2)).toEscapedString());
  var seqNo = parseInt((data.getName().get(-1)).toEscapedString());
  var name = data.getName().get(-3).toEscapedString()

  if (!(content.fromUsername in this.roster) && content.msgType != "LEAVE") {
    this.userJoin(content.fromUsername, content.fromScreenName, (new Date(content.timestamp)).toLocaleTimeString());
  }
  
  setTimeout(this.alive.bind(this, seqNo, name, session, prefix), this.checkAliveWaitPeriod);

  if (content.msgType == "CHAT" && content.fromUsername != this.username){
    var escaped_msg = $('<div/>').text(content.data).html();
    if (this.onChatData !== undefined) {
      this.onChatData(content.fromScreenName, (new Date(content.timestamp)).toLocaleTimeString(), escaped_msg);
    }
  } else if (content.msgType == "LEAVE") {
    this.userLeave(content.fromUsername, (new Date(content.timestamp)).toLocaleTimeString());
  }
};

ChronoChat.prototype.chatTimeout = function(interest)
{
  console.log("Timeout waiting for chat data: " + interest.getName().toUri());
};

ChronoChat.prototype.heartbeat = function()
{
  this.messageCacheAppend("HELLO", "");
};

ChronoChat.prototype.alive = function(temp_seq, name, session, prefix)
{
  var index_n = this.sync.digest_tree.find(prefix, session);

  if (index_n != -1 && name in this.roster) {
    // NOTE: this assumes knowledge of interior structure of ChronoSync2013 in application code.
    var seq = this.sync.digest_tree.digestnode[index_n].seqno_seq;
    
    if (temp_seq == seq) {
      this.userLeave(name, (new Date()).toLocaleTimeString());
    }
  }
};

ChronoChat.prototype.userLeave = function(username, time)
{
  console.log("user leave for " + username);
  if (username in this.roster && username != this.username) {
    if (this.onUserLeave !== undefined) {
      this.onUserLeave(this.roster[username], time, "");
    }
    delete this.roster[username];
    if (this.updateRoster !== undefined) {
      this.updateRoster(this.roster);
    }
  }
  if (username in this.interestSeqDict) {
    delete this.interestSeqDict[username]; 
  }
};

ChronoChat.prototype.userJoin = function(username, screenName, time)
{
  if (this.onUserJoin !== undefined) {
    this.onUserJoin(screenName, time, "");
  }
  this.roster[username] = screenName;
  if (this.updateRoster !== undefined) {
    this.updateRoster(this.roster);
  }
};

/**
 * Intended public facing methods; Join is now called in ChronoSync2013.onInitialized, thus called by ChronoSync2013's constructor instead; 
 */
ChronoChat.prototype.send = function(msg)
{
  // NOTE: check if this check should be here
  if (this.msgCache.length == 0)
    this.messageCacheAppend("JOIN", "");
  this.messageCacheAppend("CHAT", msg);
};

ChronoChat.prototype.leave = function()
{
  this.messageCacheAppend("LEAVE", "");
  this.userLeave(this.username, (new Date()).toLocaleTimeString());
};

ChronoChat.prototype.join = function()
{
  if (!this.roster.hasOwnProperty(this.username)) {
    this.messageCacheAppend("JOIN", "");
    this.userJoin(this.username, this.screenName, (new Date()).toLocaleTimeString());
  } else {
    console.log("Error: chat roster has this user's username");
  }
};

/**
 * Append a new ChatMessage to msgCache, using given messageType and message,
 * the sequence number from this.sync.getSequenceNo() and the current time.
 * Also remove elements from the front of the cache as needed to keep the size to
 * this.maxmsgCacheLength.
 */
ChronoChat.prototype.messageCacheAppend = function(messageType, message)
{
  var time = (new Date()).getTime();
  this.sync.publishNextSequenceNo();
  var content = new ChronoChat.ChatMessage(this.sync.getSequenceNo(), this.username, this.screenName, messageType, message, time)

  this.msgCache.push(content);
  
  if (this.usePersistentStorage && messageType !== "HELLO") {
    // Note: here memory content cache vs existing msgCache?
    var data = new Data((new Name(this.chatPrefix)).append(this.session.toString()).append(this.sync.getSequenceNo().toString()));
    data.setContent(content.encode());
    data.getMetaInfo().setFreshnessPeriod(this.chatDataLifetime);
    this.keyChain.sign(data, this.certificateName);
    this.chatStorage.add(data);
  }

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

ChronoChat.ChatMessage = function(seqNoOrChatMessageOrEncoding, fromUsername, fromScreenName, msgType, msg, timestamp)
{
  if (typeof seqNoOrChatMessageOrEncoding === 'object' && seqNoOrChatMessageOrEncoding instanceof ChronoChat.ChatMessage) {
    // Copy constructor
    var chatMessage = seqNoOrChatMessageOrEncoding;

    this.seqNo = chatMessage.seqNo;
    this.fromUsername = chatMessage.fromUsername;
    this.fromScreenName = chatMessage.fromScreenName;
    this.msgType = chatMessage.msgType;
    this.timestamp = chatMessage.timestamp;
    this.data = chatMessage.data;
    
    // TODO: find if "to" could be useful in any cases?
    this.to = "";
  } else if (typeof seqNoOrChatMessageOrEncoding === 'string') {
    // Decode from encoding constructor
    var encoding = ChronoChat.ChatMessage.decode(seqNoOrChatMessageOrEncoding);
    
    this.seqNo = encoding.seqNo;
    this.fromUsername = encoding.fromUsername;
    this.fromScreenName = encoding.fromScreenName;
    this.msgType = encoding.msgType;
    this.timestamp = encoding.timestamp;
    this.data = encoding.data;
    
    this.to = "";
  } else {
    // Value assignment constructor
    var seqNo = seqNoOrChatMessageOrEncoding;

    this.seqNo = seqNo;
    this.fromUsername = fromUsername;
    this.fromScreenName = fromScreenName;
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