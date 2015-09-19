/*
 * Copyright (C) 2014-2015 Regents of the University of California.
 * @author: Zhehao Wang <zhehao@remap.ucla.edu>
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

/**
 * FireChat constructor, user joins chatroom after successful initialization
 * @param {String} screenName The nickname of the chat user that's displayed 
 * on the screen. A 3-character random string is used if undefined
 * @param {String} username The username that the user publishes chat data with; 
 * In the tutorial's case it's the user's email. A 10-character string is used 
 * if undefined.
 * @param {String} chatroom The name of the chatroom/channel
 * @param {String} hubPrefix The prefix of the user's chat data name
 * @param {Face} face The app's face that traffic goes through
 * @param {KeyChain} keyChain The keychain handles signing/verification
 * @param {Function} onChatData, onUserLeave, onUserJoin, updateRoster; UI callbacks
 * @param {Bool} usePersistentStorage Set true for this app to use an indexeddb
 * based persistent chat data storage; defaults to False
 * @param {Bool} requireVerification Set true for this app to ignore unverified
 * sync messages; defaults to False
 */
var FireChat = function
   (screenName, username, chatroom,
    onChatData, onUserLeave, onUserJoin, updateRoster, onChatDataVerified,
    usePersistentStorage, requireVerification)
{

  var hostName = "localhost";
  var hubPrefix = "/ndn/org/icn/USER";

  this.face = new Face({host: hostName});
  var identityStorage = new IndexedDbIdentityStorage();
  var privateKeyStorage = new IndexedDbPrivateKeyStorage();
  var policyManager = new ConfigPolicyManager();

  this.keyChain = new KeyChain
    (new IdentityManager(identityStorage, privateKeyStorage),
     policyManager);
  this.keyChain.setFace(this.face);

  // Hard-coded trust anchor cert encoded as base64 string
  // My in-browser test anchor
  //var trustAnchorBase64 = "Bv0C8Qc4CANuZG4IA29yZwgDaWNuCANLRVkIDmtzay0xNDQxNDE3MzgyCAdJRC1DRVJUCAn9AAABT5srytUUAxgBAhX9AXQwggFwMCIYDzIwMTUwOTA1MDE0MzAyWhgPMjAxNzA5MDQwMTQzMDJaMCQwIgYDVQQpExsvbmRuL29yZy9pY24va3NrLTE0NDE0MTczODIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCt1v/hUxoKdi2epLAUUJElS3HCh5extviDirWJabaVrYY0n2bxeG7H/HimOSU0nfDeqc9aiaXnw0jMlI/gUs+jE2Y7oklp0M8WufCgJxKNjeqTsWJ6/Sy8j9UJA5ZFLut1wbm/0o6aj6nnQG8Ju2cJR/aDO1NjbTNdQf15EBxg2tK9kA4g3TMTc+BabGUoHWqtQdVrk1hGRy6nYhNbgra8NMefVvwHcGP2030WVh74goK90ibbz/jQq06msfHTLZWVgut+i8QeM5zf3vGPYiMz4bY+cYuvbHTzsqslUxv7UzU3arB6L+st7KywkcRydEA+cFF3eN7DwK4XKCHU0fNtAgMBAAEWNBsBARwvBy0IA25kbggDb3JnCANpY24IA0tFWQgOa3NrLTE0NDE0MTczODIIB0lELUNFUlQX/QEAiaL58x2KPtx02T6N6bWGPBcYPVaa8qn/3D/H9bpHPOiMQ8rCvP3iD0BDq/KXfNRxuoHMA41c8LVot4NqK5mCDc9w15WIpmSQ/tbY4XGH9VuS2y2eoEozfV/IT85s6k5iHZkNJl5aEfSBpPaWGuZypa3ovngkOqyYP+WZiAXQbOaYK9jRFL9RYw7WKIFiIxIDe+D0eVqgqmf+Y2YrHy2MrVQXddn4z128umhOZTaedRXv8IUs/rSkmeJVIjVEiaXNZHxd6PsWV5qDQFqx7caEjEjZlKXvDrNznk6gQ2TBfJAcdPc5/2xvwaJlFy2+LeR/dJgK5MQ9MCBAPXgFuNaheg==";
  
  // ICN cert test anchor, identity /ndn/org/icn/USER on my machine
  var trustAnchorBase64 = "Bv0DEQdBCANuZG4IA29yZwgDaWNuCARVU0VSCANLRVkIEWtzay0xNDQyMzc0MTcz\
ODk4CAdJRC1DRVJUCAn9AAABT9Q1jfwUCRgBAhkEADbugBX9AXwwggF4MCIYDzIw\
MTUwOTE2MDMzMjAzWhgPMjAzNTA5MTEwMzMyMDNaMCwwKgYDVQQpEyMvbmRuL29y\
Zy9pY24vVVNFUi9rc2stMTQ0MjM3NDE3Mzg5ODCCASIwDQYJKoZIhvcNAQEBBQAD\
ggEPADCCAQoCggEBALNdLoGnKHT+6YVW24MqHT3zMICgrlD+YmcASLrpMrFJ0oMO\
R4glXPefaVAjvaQmxwNUriOxCaD/PmrudPgCPykrRlSL0hFYTevCjRfMD+jDJMs1\
RkEo37q6i252f7v4dpYUlz96fSqEC712YxsJ9Vh0mbaYtKGQQou0+lVewR0KQbQJ\
S88Lyi/Vj6xWGxEaHAyHSPGKKip0EMehkqxegpi+Br9UGPDzNMB3OXeNuERcrcMS\
7z+qI+hgWoJAEvF7o4pEMYHkDRC6Y7JX751WCTyWiEKouIC4xrQEv6Xq70A+6xma\
Paxx4QX66ZZ6T+bbulAZj+8bc0EApRuRmRrOqwkCAwEAARY9GwEBHDgHNggDbmRu\
CANvcmcIA2ljbggEVVNFUggDS0VZCBFrc2stMTQ0MjM3NDE3Mzg5OAgHSUQtQ0VS\
VBf9AQChD7qJasfM2pLWRNY4Uz/GfsZzYJEOQy5h9QaTNAAW3vxBg5PM3UO7joNy\
xdV1bUho5iQgutg3dLPr3NgG7sPuAjMGVoXxAKOgCEulluc0MV2zwNdjw/7ywp47\
9TbDb/ysSfFi2oOV95Y/h8hZJvTRoud8mwc6LyeLsdkWbeYOe6BpIB9Bga4Uvn+P\
glaBoEwaWwOvBfvmPDwccOr22o9JVqbiWRi/ICULJ7uZUZye82LoCTgaoQqlna6F\
UTWfKrVhIhZFokinwHeDDtEw8rQrzCW5kAvcPb7CeFZzhFB5PH7b/f0n2ig6iLFh\
ycI+hnkrfUD+KbHJLhWNqRA7TBJr";

  var policy =
    "validator"                   + "\n" +
    "{"                           + "\n" +
    "  rule"                      + "\n" +
    "  {"                         + "\n" +
    "    id \"Chat Rule\""        + "\n" +
    "    for data"                + "\n" +
    "    filter"                  + "\n" +
    "    {"                       + "\n" +
    "      type name"             + "\n" +
    "      name /ndn/org/icn"     + "\n" +
    "      relation is-prefix-of" + "\n" +
    "    }"                       + "\n" +
    "    checker"                 + "\n" +
    "    {"                       + "\n" +
    "      type hierarchical"     + "\n" +
    "      sig-type rsa-sha256"   + "\n" +
    "    }"                       + "\n" +
    "  }"                         + "\n" +

    "  rule"                      + "\n" +
    "  {"                         + "\n" +
    "    id \"Sync Rule\""        + "\n" +
    "    for data"                + "\n" +
    "    filter"                  + "\n" +
    "    {"                       + "\n" +
    "      type name"             + "\n" +
    "      name /ndn/multicast/CHAT/CHANNEL" + "\n" +
    "      relation is-prefix-of" + "\n" +
    "    }"                       + "\n" +
    "    checker"                 + "\n" +
    "    {"                       + "\n" +
    "      type customized"       + "\n" +
    "      sig-type rsa-sha256"   + "\n" +
    "      key-locator"           + "\n" +
    "      {"                     + "\n" +
    "        type name"           + "\n" +
    "        regex ^<ndn><org><icn><USER><><KEY><><ID-CERT>$" + "\n" +
    "      }"                     + "\n" +
    "    }"                       + "\n" +
    "  }"                         + "\n" +

    "  trust-anchor"              + "\n" +
    "  {"                         + "\n" +
    "    type base64"             + "\n" +
    "    base64-string \"" + trustAnchorBase64 + "\"" + "\n" +
    "  }"                         + "\n" +
    "}"                           + "\n";

  policyManager.load(policy, "chat-policy");

  this.chatroom = chatroom;
  this.isRecoverySyncState = true;
  this.requireVerification = requireVerification;

  if (username === undefined || username === "") {
    this.username = this.getRandomString(10);
  } else {
    this.username = username;
  }
  
  if (screenName === undefined || screenName === "") {
    this.screenName = this.getRandomString(3);
  } else {
    this.screenName = screenName;
  }

  // NOTE: The session number used with the applicationDataPrefix in sync state messages, why is session in sync state messages?
  this.session = parseInt((new Date()).getTime()/1000);

  this.identityName = (new Name(hubPrefix)).append(this.username);
  this.chatPrefix = (new Name(this.identityName)).append("CHAT").append("CHANNEL").append(this.chatroom).append("SESSION").append(this.session.toString());
  console.log("My chat prefix: " + this.chatPrefix.toUri() + " ; My screen name " + this.screenName);

  // roster keeps the identities that have responded;
  //   key - username + user session;
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

  this.heartbeatInterval = 6000;
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
  this.onChatDataVerified = onChatDataVerified;
  this.updateRoster = updateRoster;
  
  // Create identity and certificate if not already exist; Start sync upon successful creation
  this.certBase64String = "";

  var self = this;
  this.keyChain.createIdentityAndCertificate
    (this.identityName, function(myCertificateName) {
    console.log("myCertificateName: " + myCertificateName.toUri());

    self.certificateName = myCertificateName;

    if (self.screenName == "" || self.chatroom == "") {
      console.log("input user screen name and chatroom");
    } else {
      try {
        self.face.setCommandSigningInfo(self.keyChain, self.certificateName);
        self.sync = new ChronoSync2013
          (self.sendInterest.bind(self), self.initialize.bind(self), self.chatPrefix,
           (new Name("/ndn/multicast/CHAT/CHANNEL")).append(self.chatroom), self.session,
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
    self.keyChain.getIdentityManager().identityStorage.getCertificatePromise(myCertificateName, true).then(function(certificate) {
      self.certBase64String = certificate.wireEncode().buf().toString('base64');
    });
  }, function (error) {
    console.log("Error in createIdentityAndCertificate: " + error);
  });

  this.heartbeatEvent = undefined;
};

/**
 * Process received interest for chat data.
 * @param {Name} prefix
 * @param {Interest} interest
 * @param {Face} face
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

FireChat.prototype.onRegisterFailed = function(prefix)
{
  console.log("Register failed for prefix " + prefix.toUri());
};

/**
 * Pass the interest to the application's in-memory cache if persistent storage's enabled and data's not found
 */
FireChat.prototype.onPersistentDataNotFound = function(prefix, interest, face, interestFilterId, filter)
{
  this.onInterest(prefix, interest, face, interestFilterId, filter);
};

/**
 * ChronoSync2013 onInitialize function; called after the first sync interest gets data back, or times out.
 */
FireChat.prototype.initialize = function()
{
  var self = this;
  this.heartbeatEvent = setTimeout(function () {
    self.heartbeat();
  }, self.heartbeatInterval);

  // Note: alternatively, let user call join, need changes in the library, so that initial interest is not expressed in constructor, but in a "start" function instead

  // Loads display the persistently stored local messages, sorted by timestamp upon message reception.
  var self = this;
  if (this.usePersistentStorage) {
    this.chatStorage.database.messages.toCollection().sortBy("timestamp", function(array) {
      for (var i = 0; i < array.length; i++) {
        var data = new Data();
        data.wireDecode(new Blob(array[i].content));
        self.onData(undefined, data, false, array[i].timestamp);
      }
    }).then(function(result) {
      self.join();
    }).catch(function(error) {
      console.log(error);
    });
  } else {
    this.join();
  }
};

/**
 * ChronoSync2013 onReceivedSyncStates callback; Send chat interests to fetch missing chat sequences.
 * @param {SyncStates[]} syncStates The array of sync states
 * @param {bool} isRecovery If it's in recovery state
 *
 * NOTE: for given SyncStates, sendInterest may not send interest for every currently missing sequence numbers: this may not be the expected behavior.
 */
FireChat.prototype.sendInterest = function(syncStates, isRecovery)
{
  this.isRecoverySyncState = isRecovery;

  var sendList = {};

  for (var j = 0; j < syncStates.length; j++) {
    var nameComponents = new Name(syncStates[j].getDataPrefix());
    var tempSession = nameComponents.get(-1).toEscapedString();
    var tempName = unescape(nameComponents.get(this.identityName.size() - 1).toEscapedString());
    var tempFullName = tempName + tempSession;
    
    if (tempName != this.username || tempSession != this.session) {
      if (syncStates[j].getDataPrefix() in sendList) {
        sendList[syncStates[j].getDataPrefix()].seqNo = syncStates[j].getSequenceNo();
        sendList[syncStates[j].getDataPrefix()].sessionNo = syncStates[j].getSessionNo();
      } else {
        sendList[syncStates[j].getDataPrefix()] = {"seqNo": syncStates[j].getSequenceNo(), "sessionNo": syncStates[j].getSessionNo()};
      }
    }
  }
  
  for (var dataPrefix in sendList) {
    var tempSession = (new Name(dataPrefix)).get(-1).toEscapedString();
    var tempName = unescape((new Name(dataPrefix)).get(this.identityName.size() - 1).toEscapedString());
    var tempFullName = tempName + tempSession;

    if (!(tempFullName in this.interestSeqDict) || sendList[dataPrefix].seqNo > this.interestSeqDict[tempFullName]) {
      var name = (new Name(dataPrefix)).append(sendList[dataPrefix].seqNo.toString());
      var interest = new Interest(new Name(name));
      interest.setInterestLifetimeMilliseconds(this.chatInterestLifetime);
      this.face.expressInterest(interest, this.onData.bind(this), this.chatTimeout.bind(this));
      this.interestSeqDict[tempFullName] = sendList[dataPrefix].seqNo;
      console.log("Sent interest: " + name.toUri());
    } else {
      this.interestSeqDict[tempFullName] = sendList[dataPrefix].seqNo;
    }
  }
};

FireChat.prototype.onDataVerified = function(data, updatePersistentStorage, content, name, session, seqNo)
{
  console.log("Data verified.");
  // Note: we store verified chat data into persistent storage only; old condition: (verified || !this.requireVerification)
  if (this.usePersistentStorage && updatePersistentStorage && this.chatStorage.get(data.getName().toUri()) === undefined && content.msgType !== "HELLO") {
    // Assuming that the same name in data packets always contain identitcal data packets
    this.chatStorage.add(data);
  }
  if (this.onChatDataVerified !== undefined) {
    this.onChatDataVerified(name, session, seqNo);
  }
}

FireChat.prototype.onDataVerifyFailed = function(data)
{
  console.log("Data verify failed.");
}

/**
 * OnData callback for prefix registration
 * @param {Interest}
 * @param {Data}
 * @param {Bool} updatePersistentStorage Set true or undefined if called by receiving data from face; false if called from persistentStorage traversal
 * @param {Number} onDataTimestamp The timestamp of data upon its reception
 */
FireChat.prototype.onData = function(interest, data, updatePersistentStorage, onDataTimestamp)
{
  console.log("Got data: " + data.getName().toUri());
  if (updatePersistentStorage === undefined) {
    updatePersistentStorage = true;
  }
  if (onDataTimestamp === undefined) {
    onDataTimestamp = (new Date()).getTime();
  }

  // we process the data without verifying.
  var content = new FireChat.ChatMessage(data.getContent().buf().toString('binary'));
  
  // NOTE: this makes assumption about where the names are
  var session = (data.getName().get(-2)).toEscapedString();
  var seqNo = parseInt((data.getName().get(-1)).toEscapedString());
  var name = unescape(data.getName().get(this.identityName.size() - 1).toEscapedString());
  var userFullName = name + session;

  if (content.msgType === "LEAVE") {
    if ((userFullName in this.roster) && this.roster[userFullName].checkAliveEvent !== undefined) {
      clearTimeout(this.roster[userFullName].checkAliveEvent);
    }
    this.userLeave(name, session, onDataTimestamp, false);
  } else {
    if (!(userFullName in this.roster)) {
      this.userJoin(name, session, content.fromScreenName, onDataTimestamp, seqNo, false);
      this.roster[userFullName].checkAliveEvent = setTimeout(this.checkAlive.bind(this, seqNo, name, session), this.checkAliveWaitPeriod);
    } else if (this.roster[userFullName].lastReceivedSeq < seqNo) {
      this.roster[userFullName].lastReceivedSeq = seqNo;
      // New data is received from this user, so we can cancel the previously scheduled checkAlive check.
      if (this.roster[userFullName].checkAliveEvent !== undefined) {
        clearTimeout(this.roster[userFullName].checkAliveEvent);
      }
      this.roster[userFullName].checkAliveEvent = setTimeout(this.checkAlive.bind(this, seqNo, name, session), this.checkAliveWaitPeriod);
    }
    // we don't schedule a checkAlive event, if chat data arrived out-of-order
  }

  if (content.msgType == "CHAT"){
    var escaped_msg = $('<div/>').text(content.data).html();
    if (this.onChatData !== undefined) {
      this.onChatData(content.fromScreenName, onDataTimestamp, escaped_msg, false, name, session, seqNo);
    }
  }
  
  var self = this;
  this.keyChain.verifyData(data, 
    function () {
      self.onDataVerified(data, updatePersistentStorage, content, name, session, seqNo);
    },
    function () {
      self.onDataVerifyFailed(data);
    });
};

/**
 * Timeout callback for chat data
 * TODO: re-express interest if data times out
 */
FireChat.prototype.chatTimeout = function(interest)
{
  console.log("Timeout waiting for chat data: " + interest.getName().toUri());
};

/**
 * Heartbeat function pushes HELLO type to message content cache and publishes new sync state; 
 * It's called every this.heartbeatInterval milliseconds since the last send() call
 */
FireChat.prototype.heartbeat = function()
{
  this.messageCacheAppend("HELLO", "");
};

/**
 * CheckAlive loops through current roster to find inactive participants
 * It's called this.checkAliveWaitPeriod milliseconds after the last onData() call of this participant (identified by username + session)
 * @param {Number} prevSeq Previous sequence number
 * @param {String} username
 * @param {String} session
 */
FireChat.prototype.checkAlive = function(prevSeq, name, session)
{
  var userFullName = name + session;
  if (userFullName in this.roster) {
    var seq = this.roster[userFullName].lastReceivedSeq;
    if (prevSeq == seq) {
      this.userLeave(name, session, (new Date()).getTime());
    }
  }
};

/**
 * Handles self, or other user's leave; called from processData, checkAlive, or this user's leave
 * @param {String} username
 * @param {String} session
 * @param {Number} time
 * @param {Bool} verified Undefined if called from checkAlive, or this user's leave
 */
FireChat.prototype.userLeave = function(username, session, time, verified)
{
  console.log("user leave for " + username + session);
  var userFullName = username + session;

  if (userFullName in this.roster) {
    if (this.onUserLeave !== undefined) {
      this.onUserLeave(this.roster[userFullName].screenName, time, "", verified);
    }
    if (verified === undefined || verified || !this.requireVerification) {
      delete this.roster[userFullName];
      if (this.updateRoster !== undefined) {
        this.updateRoster(this.roster);
      }
    }
  }
  if (verified === undefined || verified || !this.requireVerification) {
    if (userFullName in this.interestSeqDict) {
      delete this.interestSeqDict[userFullName]; 
    }
  }
};

/**
 * Handles self, or other user's join; called from processData, or this user's join
 * @param {String} username
 * @param {String} session
 * @param {String} screenName
 * @param {Number} time
 * @param {Number} sequenceNo The sequence number of this join messages, used for lastReceivedSeq record in roster
 * @param {Bool} verified Undefined if called from this user's join
 */
FireChat.prototype.userJoin = function(username, session, screenName, time, sequenceNo, verified)
{
  if (this.onUserJoin !== undefined) {
    this.onUserJoin(screenName, time, "", verified, username, session, sequenceNo);
  }
  if (verified === undefined || verified || !this.requireVerification) {
    var userFullName = username + session;
    if (sequenceNo !== undefined) {
      // Other participants
      this.roster[userFullName] = {'screenName': screenName, 'lastReceivedSeq': sequenceNo};
    } else {
      // Self participant
      this.roster[userFullName] = {'screenName': screenName, 'lastReceivedSeq': 0};
    }
    if (this.updateRoster !== undefined) {
      this.updateRoster(this.roster);
    }  
  }
};

/**
 * Intended public facing methods; 
 * Though join is now called in ChronoSync2013.onInitialized, thus called by FireChat's constructor instead; 
 */

/**
 * Append a message to the message cache, and publish new sync state upon calling
 * @param {String} msg The message to send
 */
FireChat.prototype.send = function(msg)
{
  // NOTE: check if this check should be here
  if (this.msgCache.length == 0)
    this.messageCacheAppend("JOIN", "");
  this.messageCacheAppend("CHAT", msg);

  this.onChatData(this.screenName, (new Date()).getTime(), msg);
};

/**
 * This user's leave; not called for now.
 */
FireChat.prototype.leave = function()
{
  this.messageCacheAppend("LEAVE", "");
  this.userLeave(this.username, this.session, (new Date()).getTime());
};

/**
 * This user's leave; called automatically in constructor for now.
 */
FireChat.prototype.join = function()
{
  var userFullName = this.username + this.session;
  if (!(userFullName in this.roster)) {
    this.messageCacheAppend("JOIN", "");
    this.userJoin(this.username, this.session, this.screenName, (new Date()).getTime());
  } else {
    console.log("Error: chat roster has this user's username");
  }
};

/**
 * Append a new ChatMessage to msgCache
 * @param {String} messageType The type of this message
 * @param {String} message The message to append
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
    var self = this;
    this.keyChain.sign(data, this.certificateName, function() {
      self.chatStorage.add(data);
    });
  }
  
  if (this.heartbeatEvent !== undefined) {
    clearTimeout(this.heartbeatEvent);
  }

  while (this.msgCache.length > this.maxmsgCacheLength) {
    this.msgCache.shift();
  }

  var self = this;
  this.heartbeatEvent = setTimeout(function () {
    self.heartbeat();
  }, this.heartbeatInterval);
};

/**
 * Helper function
 */
FireChat.prototype.getRandomString = function(len)
{
  var seed = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM0123456789';
  var result = '';
  for (var i = 0; i < len; i++) {
    var pos = Math.floor(Math.random() * seed.length);
    result += seed[pos];
  }
  return result;
};

/**
 * ChatMessage embedded class that encapsulates a chat message; handles encode/decode in JSON
 * @param {Number | ChatMessage | string} seqNoOrChatMessageOrEncoding The sequence number; ChatMessage object; or string after JSON encoding
 * @param {String} fromUsername The username of the message's source
 * @param {String} fromScreenName The screenName of the message's source
 * @param {String} msgType The type of this message
 * @param {String} msg The message
 * @param {Number} timestamp The source timestamp of this message
 */
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
