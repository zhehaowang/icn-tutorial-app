# icn-tutorial-app

Sync based chat/multimedia app with signing/verification for ICN tutorial.

Zhehao Wang <zhehao@remap.ucla.edu>

### Online trial

Please try the app out at: http://memoria.ndn.ucla.edu/icn-tutorial/icn-tutorial-app (For now, please use **Firefox** only; tested with 40 and 41)

Please request a certificate at: http://memoria.ndn.ucla.edu:5000 (For now, please ignore the instructions there, and follow the steps in this document)

_You can use the online demo without getting certified, but the messages will be marked in a different color, and it will take much longer for the messages to get displayed. (Other participant keeps trying to verify)_

### How to use

1. Provide an email and nickname, and join the default channel; (Random string or nickname will be generated if left empty)
2. Get certified (similar as ndncert): 
    * Open <a href="http://memoria.ndn.ucla.edu:5000" target="_blank">this link</a> and submit your email
    * Check your email for a link with token from testname.zhehao@gmail.com, open that link
    * Go back to chat page, click the dots button at the top right corner, then click "Request certificate"
    * Copy the base64 string from the prompted dialog and paste it to the certificate field in the above-opened link
    * Make sure you've put in username and certificate, then submit
    * The cert should be automatically issued and emailed to your email account; it's up to you to install it in browser (by clicking the "install signed cert" button, the dialog would close automatically upon successful installation), or let the cert server keep and serve your signed cert.
3. Chat (for now plain text only)

For now, an indexeddb based local historical chat storage is enabled by default; _Your_ past chat history (using the same email) could be served by the storage.

### Source

Directories/file structure: 
 - **tutorial-app** 
    -  **js**
        -  **page.js**           // JS that interacts with the webpage, includes UI calls, and FireChat class function calls
        -  **fire-chat.js**      // Chrono-chat updated and renamed; Should be able to decide the functions/interfaces of FireSync based on this
    -  **css**
        -  **styles.css**        // CSS for the page, Dustin, material design
    -  **tests**
        -  **dbtestpage.html**   // Can be used for clearing the local chat storage
    -  **index.html**            // Demo'ed webpage


##### Public API for FireChat class

**Constructor**, user joins chatroom after successful initialization; The constructor calls createIdentityCertificate, which tries to find an existing certificate for given identity name, or generates a certificate is such is not found.

```javascript
/**
 * FireChat constructor, user joins chatroom after successful initialization
 * @param {String} screenName The nickname of the chat user that's displayed 
 * on the screen. A 3-character random string is used if undefined
 * @param {String} username The username that the user publishes chat data with; 
 * In the tutorial's case it's the user's email. A 10-character string is used 
 * if undefined.
 * @param {String} chatroom The name of the chatroom/channel
 * @param {Function} onChatData, onUserLeave, onUserJoin, updateRosterm onChatDataVerified; UI callbacks
 * @param {Bool} usePersistentStorage Set true for this app to use an indexeddb
 * based persistent chat data storage; defaults to False
 * @param {Bool} requireVerification Set true for this app to ignore unverified
 * sync messages; defaults to False
 */
var FireChat = function
   (screenName, username, chatroom,
    onChatData, onUserLeave, onUserJoin, updateRoster, onChatDataVerified
    usePersistentStorage, requireVerification)
```

**join** method, call to join the chatroom; called automatically by constructor for now.

```javascript
/**
 * This user's join; called automatically in constructor for now.
 */
FireChat.prototype.join = function()
```

**send** message method, call to send a message to the chatroom;

```javascript
/**
 * Append a message to the message cache, and publish new sync state upon calling
 * @param {String} msg The message to send
 */
FireChat.prototype.send = function(msg)
```

**leave** method, call to leave the chatroom.

```javascript
/**
 * This user's leave; not called for now.
 */
FireChat.prototype.leave = function()
```

**onUserJoin** callback method, called when a user join is received, not verified. Passed to FireChat in constructor.

```javascript
/**
 * User join callback to pass into FireChat class
 * @param {String} from The screen name of the user that joined
 * @param {Number} time The receive time of join message
 * @param {String} msg The message that comes with the join message, ignored
 * @param {Bool} verified Since we decided to move this out of onVerified to onData, other user join will always be unverified
 * @param {String} name The user name of the user that joined
 * @param {String} session The session name of the user that joined
 * @param {Number} seqNo The sequence number of this join message; this concatenated with name and session is used to identify an html element if needed, so that we can change the style of that element upon verification or verification failed; alternative: expose verify method (with NDN data as parameter?) and call verify inline
 */
function onUserJoin(from, time, msg, verified, name, session, seqNo)
```

**onUserLeave** callback method, called when a user leaves, or does not update heartbeat for given ammount of time, not verified. Passed to FireChat in constructor.

```javascript
/**
 * Same parameters as onUserJoin
 */
function onUserLeave(from, time, msg, verified, name, session, seqNo)
```

On chat message callback method, called when a non-heartbeat chat message is received.

```javascript
/**
 * Same parameters as onUserJoin
 */
function onChatData(from, time, msg, verified, name, session, seqNo)
```

**onUpdateRoster** method, usually called right before a user join or leave. Passed to FireChat in constructor.

```javascript
/**
 * Update roster function, usually called right after onUserJoin, or onUserLeave
 * @param {Object} roster, the roster is a dictionary keyed by "username + session", value is an object of {"screenName": "XXX", lastReceivedSeqNo: XX}
 */
function updateRoster(roster)
```

**onChatDataVerified** method, called after a piece of chat data is successfullly verified. Passed to FireChat in constructor.

```javascript
/**
 * onChatDataVerified is called when a piece of data is successfully verified
 * @param {String} name The username of the verified data
 * @param {String} session The session name of the verified data
 * @param {Number} seqNo The sequence number of the verified data; this concatenated with name and session is used to identify an html element if needed
 */
function onChatDataVerified(name, session, seqNo)
```

**getBase64CertString** method, returns any certificate with the identity name of this when called.

```javascript
/**
 * Library interface for getting current ID cert
 * @return {String} The (base64 encoded) default certificate of this instance's
 */
FireChat.prototype.getBase64CertString = function()

```

**installIdentityCertificate** method, installs the certificate (base64 string) into this browser's indexeddb based identity storage

```javascript
/**
 * Library interface for installing ID cert
 * @param {String} signedCertString The signed certificate string encoded in base64
 * @param {Function} onSuccess() Success callback for id cert installed
 * @param {Function} onError(error) Error callback
 */
FireChat.prototype.installIdentityCertificate = function(signedCertString, onSuccess, onError)
```

##### Call logic from application code

In page.js (code is being updated)

```javascript
  // Create the FireChat class and join the given chatroom
  var chronoChat = new FireChat
    (screenName, username, chatroom, 
     onChatData, onUserLeave, onUserJoin, updateRoster, onChatDataVerified,
     true, false);
  ...
  
  var unsignedCert = chronoChat.getBase64CertString();
  ...
  chronoChat.installIdentityCertificate(signedCert, function () {
      console.log("Cert installation ready.");
      ...
  });
  ...

  // Sending chat messages
  chronoChat.send("Hi there");
  ...
  
  // Leave before window unloads
  chronoChat.leave();

```

##### Dependencies: 
* ndn-js (latest version Sept 16), 
* jquery (using 1.11),
* jquery ui,
* dexie (from ndn-js); Expects IndexedDB support from browser

Please refer to [this repository](https://github.com/zhehaowang/openmhealth-cert/tree/icn-cert-deployment) for details of the cert site, currently being updated

### Namespace, data payload and trust schema

**Chat**

For the tutorial app, the chat data name is /ndn/org/icn/USER/[username]/CHAT/CHANNEL/[chatroom]/SESSION/[session]/[seq], in which session is the time when constructor's called. 

For example, /ndn/org/icn/USER/zhehao@remap.ucla.edu/CHAT/CHANNEL/tutorial-chat/SESSION/1442616246/20.

The payload for this data looks like
```json
{
  "seqNo": 20,
  "fromUsername": "zhehao@remap.ucla.edu",
  "fromScreenName": "zhehao",
  "msgType": "CHAT",
  "timestamp": 1442619817,
  "data": "Hi there!"
}
```
The current message types in the app are "JOIN", "CHAT", "HELLO", and "LEAVE".

**Sync**

The sync data name is /ndn/multicast/CHAT/CHANNEL/[chatroom]/[digest]; 

For example, /ndn/multicast/CHAT/CHANNEL/tutorial-chat/e6c18e9e14ab745af533c45f404cc571fada9f6b76fbbe2616f70e2ad9727780.

Its payload is a Protobuf encoded sync tree.

(Picture of sync tree here) e6c18e9e14ab745af533c45f404cc571fada9f6b76fbbe2616f70e2ad9727780 - user: "zhehao@remap.ucla.edu1442616246", seq: 20

**User**

User identity: /ndn/org/icn/USER/zhehao@remap.ucla.edu

User certificate: /ndn/org/icn/USER/zhehao@remap.ucla.edu/KEY/ksk-1442514568/ID-CERT/%FD%00%00%01O%DC%92%E5%7E

Given the user identity, the trust schema for sync and chat data is:

**Trust schema**

```javascript
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
```

For now, unverified sync data will trigger onReceivedSyncState callback, thus the library would tell the user to fetch missing messages even if the sync data is a bogus.

##### Sync mechanism

[ChronoSync paper](http://irl.cs.ucla.edu/~zhenkai/papers/chronosync.pdf)

Leave mechanism: user produces a heartbeat (message type "HELLO") every 6s, if in a user in your roster does not update its sequence number in 18s, that user will be considered as left the chatroom.

### Known Issues

Currently working on:
* Interest re-expression onTimeout, believed to cause multiple join/leaves without actual user behavior
* Display unverified messages with less delay?
* Caching leave messages when user not leaving gracefully?
* Support for later versions of Chrome, which requires a secure source (or https deployment); createIdentityCertificate likely throws this exception, investigating
* Feature support, for example multimedia
* UI improvements

### License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License along with this program. If not, see http://www.gnu.org/licenses/. A copy of the GNU Lesser General Public License is in the file LICENSE.

##### Material Design Lite License

This work uses Material Design Lite, under Apache License v2; available as MaterialDesignLite-license.txt in this repository.