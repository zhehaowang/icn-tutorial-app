var chronoChat;
var screenName = "";
var username = "";

$(document).ready(function(){
  $("#email-dialog").dialog({
    autoOpen: true,
    buttons: {
      "OK": function() {
        username = $("#emailInput").val();
        if (username === "") {
          username = getRandomNameString(10);
        }

        screenName = $("#screenNameInput").val();
        if (screenName === "") {
          screenName = getRandomNameString(3);
        }

        $(this).dialog('close');
        startFireChat();
      }
    }
  });
});

function startFireChat()
{
  var hubPrefix = "/ndn/org/icn/USER";
  var chatroom = "more";
  var hostName = "localhost";

  var face = new Face({host: hostName});
  var identityStorage = new IndexedDbIdentityStorage();
  var privateKeyStorage = new IndexedDbPrivateKeyStorage();
  var policyManager = new ConfigPolicyManager();

  var keyChain = new KeyChain
    (new IdentityManager(identityStorage, privateKeyStorage),
     policyManager);
  keyChain.setFace(face);

  // Hard-coded trust anchor cert encoded as base64 string
  var trustAnchorBase64 = "Bv0C8Qc4CANuZG4IA29yZwgDaWNuCANLRVkIDmtzay0xNDQxNDE3MzgyCAdJRC1DRVJUCAn9AAABT5srytUUAxgBAhX9AXQwggFwMCIYDzIwMTUwOTA1MDE0MzAyWhgPMjAxNzA5MDQwMTQzMDJaMCQwIgYDVQQpExsvbmRuL29yZy9pY24va3NrLTE0NDE0MTczODIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCt1v/hUxoKdi2epLAUUJElS3HCh5extviDirWJabaVrYY0n2bxeG7H/HimOSU0nfDeqc9aiaXnw0jMlI/gUs+jE2Y7oklp0M8WufCgJxKNjeqTsWJ6/Sy8j9UJA5ZFLut1wbm/0o6aj6nnQG8Ju2cJR/aDO1NjbTNdQf15EBxg2tK9kA4g3TMTc+BabGUoHWqtQdVrk1hGRy6nYhNbgra8NMefVvwHcGP2030WVh74goK90ibbz/jQq06msfHTLZWVgut+i8QeM5zf3vGPYiMz4bY+cYuvbHTzsqslUxv7UzU3arB6L+st7KywkcRydEA+cFF3eN7DwK4XKCHU0fNtAgMBAAEWNBsBARwvBy0IA25kbggDb3JnCANpY24IA0tFWQgOa3NrLTE0NDE0MTczODIIB0lELUNFUlQX/QEAiaL58x2KPtx02T6N6bWGPBcYPVaa8qn/3D/H9bpHPOiMQ8rCvP3iD0BDq/KXfNRxuoHMA41c8LVot4NqK5mCDc9w15WIpmSQ/tbY4XGH9VuS2y2eoEozfV/IT85s6k5iHZkNJl5aEfSBpPaWGuZypa3ovngkOqyYP+WZiAXQbOaYK9jRFL9RYw7WKIFiIxIDe+D0eVqgqmf+Y2YrHy2MrVQXddn4z128umhOZTaedRXv8IUs/rSkmeJVIjVEiaXNZHxd6PsWV5qDQFqx7caEjEjZlKXvDrNznk6gQ2TBfJAcdPc5/2xvwaJlFy2+LeR/dJgK5MQ9MCBAPXgFuNaheg==";

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

  chronoChat = new FireChat
    (screenName, username, chatroom, hubPrefix, face, keyChain, onChatData, onUserLeave, onUserJoin, updateRoster, false, false);

  $("#chatBtn").click(function () {
    sendMessageClick();
  });

  $("#chatTextInput").keyup(checkKey);
  
  // Note: BeforeUnload event may not work in Opera; support in other browsers to be tested, too.
  // if called in unload instead, the Dexie.table.put promise may not have time to finish, thus having LEAVE message not inserted
  $(window).bind('beforeunload', function(e) {
    try {
      chronoChat.leave();
    } catch (e) {
      console.log(e);
    }
  });
}

function sendMessageClick() {
  var chatMsg = $("#chatTextInput").val();
  if (chatMsg != "") {

    var date = new Date();
    var time = date.toLocaleTimeString();
    // Encode special html characters to avoid script injection.
    var escaped_msg = $('<div/>').text(chatMsg).html();

    onChatData(screenName, time, escaped_msg);

    chronoChat.send(escaped_msg);
    $("#chatTextInput").val("");
  }
  else
    alert("Message cannot be empty");
}

/**
 * @param name
 * @param time
 * @param msg
 */
function onUserLeave(from, time, msg, verified) {
  var objDiv = document.getElementById("chatDisplayDiv");
  objDiv.innerHTML += '<p><span>' + from + '-' + time + '</span>: Leave</p>';
}

function onChatData(from, time, msg, verified) {
  var objDiv = document.getElementById("chatDisplayDiv");
  objDiv.innerHTML += '<p><span>' + from + '-' + time + '</span><br>' + msg + '</p>';
}

function onUserJoin(from, time, msg, verified) {
  var objDiv = document.getElementById("chatDisplayDiv");
  objDiv.innerHTML += '<p><span>' + from + '-' + time + '</span>: Join</p>';
}

function updateRoster(roster) {
  var objDiv = document.getElementById("rosterDisplayDiv");
  objDiv.innerHTML = "";
  for (var name in roster) {
    // Note: this assumes application knowledge of structure of object Roster
    objDiv.innerHTML += '<li>' + roster[name].screenName + '</li>';
  }
  objDiv.innerHTML += '</ul>';
}

// Enable sending the message by pressing 'Enter'.
function checkKey(event) {
  if (event.keyCode == 13) {
    sendMessageClick();
  }
}

function getRandomNameString(len)
{
  var seed = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM';
  var result = '';
  for (var i = 0; i < len; i++) {
    var pos = Math.floor(Math.random() * seed.length);
    result += seed[pos];
  }
  return result;
};
