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

// TODO: Test if my ChronoSync lib handles recovery correctly.

// NOTE: constructor now takes the actual username as a parameter
// requireVerification decides whether a unverified piece of data should trigger checkAlive timeouts and store into indexeddb
var FireChat = function
   (screenName, username, chatroom, hubPrefix, 
    face, keyChain, 
    onChatData, onUserLeave, onUserJoin, updateRoster,
    usePersistentStorage, requireVerification)
{
  this.screenName = screenName;
  this.chatroom = chatroom;
  this.isRecoverySyncState = true;
  this.face = face;
  this.keyChain = keyChain;
  this.requireVerification = requireVerification;

  if (username === undefined) {
    this.username = this.getRandomString();
  } else {
    this.username = username;
  }

  // NOTE: The session number used with the applicationDataPrefix in sync state messages, why is session in sync state messages?
  this.session = parseInt((new Date()).getTime()/1000);

  this.identityName = (new Name(hubPrefix)).append(this.username);
  this.chatPrefix = (new Name(this.identityName)).append("CHAT").append("CHANNEL").append(this.chatroom).append("SESSION").append(this.session.toString());
  console.log("My chat prefix: " + this.chatPrefix.toUri() + " ; My screen name " + this.screenName);

  // roster keeps the identities that have responded; 
  //   key - unique username; 
  //   value - {screenName: user's screen name, 
  //            lastReceivedSeq: last received sequence number from user,
  //            checkAliveEvent: the timeout event for checking back whether this participant is alive};
  this.roster = {};
  // interestSeqDict keeps the sequence numbers of interests that are sent;
  //   key - unique username;
  //   value - latest sequence number for this username that we sent;
  this.interestSeqDict = {};

  this.msgCache = [];
  
  this.maxmsgCacheLength = 100;
  this.syncLifetime = 5000;
  this.chatInterestLifetime = 3000;

  this.heartbeatInterval = 10000;
  // NOTE: if the data takes longer than heartbeatInterval to arrive, a leave will be posted; this may not be ideal
  this.checkAliveWaitPeriod = this.heartbeatInterval * 2;
  
  this.chatDataLifetime = 10000;
  //this.username = this.screenName + session;
  
  this.usePersistentStorage = usePersistentStorage;
  if (this.usePersistentStorage === undefined) {
    this.usePersistentStorage = false;
  }
  if (this.usePersistentStorage) {
    this.chatStorage = new IndexedDbChatStorage("chatdb", this.face);
  }

  // UI callbacks
  this.onChatData = onChatData;
  this.onUserLeave = onUserLeave;
  this.onUserJoin = onUserJoin;
  this.updateRoster = updateRoster;  

  //this.chatStorage.delete();

  var self = this;
  this.keyChain.createIdentityAndCertificate
    (this.identityName, function(myCertficateName) {
    console.log("myCertficateName: " + myCertficateName.toUri());

    self.certificateName = myCertficateName;

    if (self.screenName == "" || self.chatroom == "") {
      console.log("input username and chatroom");
    } else {
      try {
        self.face.setCommandSigningInfo(self.keyChain, self.certificateName);
        self.sync = new ChronoSync2013
          (self.sendInterest.bind(self), self.initial.bind(self), self.chatPrefix,
           (new Name("/ndn/broadcast/FireChat-0.3")).append(self.chatroom), self.session,
            self.face, self.keyChain, self.certificateName, self.syncLifetime,
            self.onRegisterFailed.bind(self));
      } catch (e) {
        console.log(e);
      }

      // NOTE: same face tries to register for the same prefix twice with different callbacks, if this is not put in an if/else
      if (self.usePersistentStorage) {
        self.chatStorage.registerPrefix(self.chatPrefix, self.onRegisterFailed.bind(self), self.onPersistentDataNotFound.bind(self));
      } else {
        face.registerPrefix
          (self.chatPrefix, self.onInterest.bind(self),
           self.onRegisterFailed.bind(self));
      }
    }
  });
};

/**
 * Send the data packet which contains the user's message
 * @param {Name} Interest name prefix
 * @param {Interest} The interest
 * @param {Face} The face
 * @param {number} interestFilterId
 * @param {InterestFilter} filter
 */
FireChat.prototype.onInterest = function
  (prefix, interest, face, interestFilterId, filter)
{
  var seq = parseInt(interest.getName().get(-1).toEscapedString());
  for (var i = this.msgCache.length - 1 ; i >= 0; i--) {
    if (this.msgCache[i].seqNo == seq) {
      var data = new Data(interest.getName());
      data.setContent(this.msgCache[i].encode());
      data.getMetaInfo().setFreshnessPeriod(this.chatDataLifetime);

      this.keyChain.sign(data, this.certificateName, function() {
        console.log("Data was signed. key locator: " +
          data.getSignature().getKeyLocator().getKeyName().toUri());
        try {
          face.putData(data);
        } catch (e) {
          console.log(e.toString());
        }
      });
      break;
    }
  }
};

FireChat.prototype.onPersistentDataNotFound = function(prefix, interest, face, interestFilterId, filter)
{
  this.onInterest(prefix, interest, face, interestFilterId, filter);
};

FireChat.prototype.onRegisterFailed = function(prefix)
{
  console.log("Register failed for prefix " + prefix.toUri());
};

FireChat.prototype.initial = function()
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
 * Send a Chat interest to fetch chat messages after the user gets the Sync data packet
 * @param {SyncStates[]} The array of sync states
 * @param {bool} if it's in recovery state
 *
 * NOTE: for given SyncStates, sendInterest may not send interest for every currently missing sequence numbers: this may not be the expected behavior.
 */
FireChat.prototype.sendInterest = function(syncStates, isRecovery)
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
      var name = (new Name(dataPrefix)).append(sendList[dataPrefix].seqNo.toString());
      var interest = new Interest(new Name(name));
      interest.setInterestLifetimeMilliseconds(this.chatInterestLifetime);
      this.face.expressInterest(interest, this.onData.bind(this), this.chatTimeout.bind(this));
      this.interestSeqDict[tempName] = sendList[dataPrefix].seqNo;
    } else {
      this.interestSeqDict[tempName] = sendList[dataPrefix].seqNo;
    }
  }
};

FireChat.prototype.processData = function(interest, data, verified)
{
  var content = new FireChat.ChatMessage(data.getContent().buf().toString('binary'));
  
  // NOTE: this makes assumption about where the names are
  var session = parseInt((data.getName().get(-2)).toEscapedString());
  var seqNo = parseInt((data.getName().get(-1)).toEscapedString());
  var name = data.getName().get(-7).toEscapedString();

  if (!(content.fromUsername in this.roster) && content.msgType != "LEAVE") {
    this.userJoin(content.fromUsername, content.fromScreenName, (new Date(content.timestamp)).toLocaleTimeString(), verified);
  }
  
  if (content.msgType == "CHAT" && content.fromUsername != this.username){
    var escaped_msg = $('<div/>').text(content.data).html();
    if (this.onChatData !== undefined) {
      this.onChatData(content.fromScreenName, (new Date(content.timestamp)).toLocaleTimeString(), escaped_msg, verified);
    }
  } else if (content.msgType == "LEAVE") {
    this.userLeave(content.fromUsername, (new Date(content.timestamp)).toLocaleTimeString(), verified);
  }

  if (content.fromUsername in this.roster && (verified || !this.requireVerification)) {
    this.roster[content.fromUsername].lastReceivedSeq = seqNo;
    // New data is received from this user, so we can cancel the previously scheduled checkAlive check.
    if (this.roster[content.fromUsername].checkAliveEvent !== undefined) {
      clearTimeout(this.roster[content.fromUsername].checkAliveEvent);
    }
    this.roster[content.fromUsername].checkAliveEvent = setTimeout(this.checkAlive.bind(this, seqNo, name), this.checkAliveWaitPeriod);  
  }

  if (this.usePersistentStorage && this.chatStorage.get(data.getName().toUri()) === undefined && content.msgType !== "HELLO" && (verified || !this.requireVerification)) {
    // Assuming that the same name in data packets always contain identitcal data packets
    this.chatStorage.add(data);
  }
}

FireChat.prototype.onData = function(interest, data)
{
  console.log("Got data: " + data.getName().toUri());

  var self = this;
  this.keyChain.verifyData(data, 
    function () {
      console.log("Data verified.");
      self.processData(interest, data, true);
    },
    function () {
      console.log("Data verify failed.");
      self.processData(interest, data, false);
    });
};

FireChat.prototype.chatTimeout = function(interest)
{
  console.log("Timeout waiting for chat data: " + interest.getName().toUri());
};

FireChat.prototype.heartbeat = function()
{
  this.messageCacheAppend("HELLO", "");
};

FireChat.prototype.checkAlive = function(prevSeq, name)
{
  if (name in this.roster) {
    var seq = this.roster[name].lastReceivedSeq;    
    if (prevSeq == seq) {
      this.userLeave(name, (new Date()).toLocaleTimeString());

      // Note: for participants who already left but whose leave message did not get through to the local storage, 
      // we can only detect that they left after the checkAliveInterval;
      // Creating our own leave messages for those participants as if we received them is bad, because they may not have left, 
      // and the history in the network would be messed up.
      /*
      if (this.usePersistentStorage) {

      }
      */
    }
  }
};

FireChat.prototype.userLeave = function(username, time, verified)
{
  console.log("user leave for " + username);
  if (username in this.roster && username != this.username) {
    if (this.onUserLeave !== undefined) {
      this.onUserLeave(this.roster[username].screenName, time, "", verified);
    }
    if (verified === undefined || verified || !this.requireVerification) {
      delete this.roster[username];
      if (this.updateRoster !== undefined) {
        this.updateRoster(this.roster);
      }  
    }
  }
  if (verified === undefined || verified || !this.requireVerification) {
    if (username in this.interestSeqDict) {
      delete this.interestSeqDict[username]; 
    }
  }
};

// userJoin or userLeave called by this user passes verified undefined, and should be trusted.
FireChat.prototype.userJoin = function(username, screenName, time, sequenceNo, verified)
{
  if (this.onUserJoin !== undefined) {
    this.onUserJoin(screenName, time, "", verified);
  }
  if (verified === undefined || verified || !this.requireVerification) {
    if (sequenceNo !== undefined) {
      this.roster[username] = {'screenName': screenName, 'lastReceivedSeq': sequenceNo};
    } else {
      this.roster[username] = {'screenName': screenName, 'lastReceivedSeq': 0};
    }
    if (this.updateRoster !== undefined) {
      this.updateRoster(this.roster);
    }  
  }
};

/**
 * Intended public facing methods; Join is now called in ChronoSync2013.onInitialized, thus called by ChronoSync2013's constructor instead; 
 */
FireChat.prototype.send = function(msg)
{
  // NOTE: check if this check should be here
  if (this.msgCache.length == 0)
    this.messageCacheAppend("JOIN", "");
  this.messageCacheAppend("CHAT", msg);
};

FireChat.prototype.leave = function()
{
  this.messageCacheAppend("LEAVE", "");
  this.userLeave(this.username, (new Date()).toLocaleTimeString());
};

FireChat.prototype.join = function()
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
FireChat.prototype.messageCacheAppend = function(messageType, message)
{
  var time = (new Date()).getTime();
  this.sync.publishNextSequenceNo();
  var content = new FireChat.ChatMessage(this.sync.getSequenceNo(), this.username, this.screenName, messageType, message, time);

  this.msgCache.push(content);
  
  if (this.usePersistentStorage && messageType !== "HELLO") {
    // Note: here memory content cache vs existing msgCache?
    var data = new Data((new Name(this.chatPrefix)).append(this.sync.getSequenceNo().toString()));
    data.setContent(content.encode());
    data.getMetaInfo().setFreshnessPeriod(this.chatDataLifetime);
    this.keyChain.sign(data, this.certificateName, function() {
      console.log("Data was signed. key locator: " +
        data.getSignature().getKeyLocator().getKeyName().toUri());
      this.chatStorage.add(data);
    });
  }

  while (this.msgCache.length > this.maxmsgCacheLength) {
    this.msgCache.shift();
  }
};

FireChat.prototype.getRandomString = function()
{
  var seed = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM0123456789';
  var result = '';
  for (var i = 0; i < 10; i++) {
    var pos = Math.floor(Math.random() * seed.length);
    result += seed[pos];
  }
  return result;
};

FireChat.ChatMessage = function (seqNoOrChatMessageOrEncoding, fromUsername, fromScreenName, msgType, msg, timestamp)
{
  if (typeof seqNoOrChatMessageOrEncoding === 'object' && seqNoOrChatMessageOrEncoding instanceof FireChat.ChatMessage) {
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
    var encoding = FireChat.ChatMessage.decode(seqNoOrChatMessageOrEncoding);
    
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

FireChat.ChatMessage.prototype.encode = function()
{
  return JSON.stringify(this);
};

FireChat.ChatMessage.decode = function(encoding)
{
  return JSON.parse(encoding);
};
