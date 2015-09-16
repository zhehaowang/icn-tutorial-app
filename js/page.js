/*
 * Copyright (C) 2014-2015 Regents of the University of California.
 * @author: Zhehao Wang <zhehao@remap.ucla.edu>
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

var chronoChat;
var screenName = "";
var username = "";
var enabled = false;

var showCertDialog;
var installCertDialog;
var emailDialog;

$(document).ready(function(){
  // Dialog initialization: Input email, show cert, install cert dialog
  showCertDialog = $("#show-cert-dialog").dialog({
    title: "Show Cert",
    autoOpen: false,
    open: function() {
      if (chronoChat.hasOwnProperty("certBase64String") && chronoChat.certBase64String !== "") {
        $("#certString").text(chronoChat.certBase64String);
      } else {
        $("#certString").text("Cert not ready yet");
      }
    }
  });

  installCertDialog = $("#install-cert-dialog").dialog({
    title: "Install Cert",
    autoOpen: false,
    open: function() {

    }
  });

  emailDialog = $("#email-dialog").dialog({
    title: "Email/Name",
    autoOpen: true,
    buttons: {
      "OK": function() {
        $(this).dialog('close');
      }
    },
    close: function () {
      if (!enabled) {
        username = $("#emailInput").val();
        if (username === "") {
          username = getRandomNameString(10);
        }

        screenName = $("#screenNameInput").val();
        if (screenName === "") {
          screenName = getRandomNameString(3);
        }

        startFireChat();
      } else {
        console.log("FireChat already started.");
      }
    },
    open: function() {
      $("#screenNameInput").keyup(function (e) {
        if (e.keyCode == $.ui.keyCode.ENTER) {
          emailDialog.dialog('option', 'buttons')['OK'].apply(emailDialog);
        }
      });
    }
  });
});

function startFireChat()
{
  var hubPrefix = "/ndn/org/icn/USER";
  var chatroom = "test-channel";
  var hostName = "memoria.ndn.ucla.edu";

  var face = new Face({host: hostName});
  var identityStorage = new IndexedDbIdentityStorage();
  var privateKeyStorage = new IndexedDbPrivateKeyStorage();
  var policyManager = new ConfigPolicyManager();

  var keyChain = new KeyChain
    (new IdentityManager(identityStorage, privateKeyStorage),
     policyManager);
  keyChain.setFace(face);

  // Hard-coded trust anchor cert encoded as base64 string
  // My in-browser test anchor
  //var trustAnchorBase64 = "Bv0C8Qc4CANuZG4IA29yZwgDaWNuCANLRVkIDmtzay0xNDQxNDE3MzgyCAdJRC1DRVJUCAn9AAABT5srytUUAxgBAhX9AXQwggFwMCIYDzIwMTUwOTA1MDE0MzAyWhgPMjAxNzA5MDQwMTQzMDJaMCQwIgYDVQQpExsvbmRuL29yZy9pY24va3NrLTE0NDE0MTczODIwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCt1v/hUxoKdi2epLAUUJElS3HCh5extviDirWJabaVrYY0n2bxeG7H/HimOSU0nfDeqc9aiaXnw0jMlI/gUs+jE2Y7oklp0M8WufCgJxKNjeqTsWJ6/Sy8j9UJA5ZFLut1wbm/0o6aj6nnQG8Ju2cJR/aDO1NjbTNdQf15EBxg2tK9kA4g3TMTc+BabGUoHWqtQdVrk1hGRy6nYhNbgra8NMefVvwHcGP2030WVh74goK90ibbz/jQq06msfHTLZWVgut+i8QeM5zf3vGPYiMz4bY+cYuvbHTzsqslUxv7UzU3arB6L+st7KywkcRydEA+cFF3eN7DwK4XKCHU0fNtAgMBAAEWNBsBARwvBy0IA25kbggDb3JnCANpY24IA0tFWQgOa3NrLTE0NDE0MTczODIIB0lELUNFUlQX/QEAiaL58x2KPtx02T6N6bWGPBcYPVaa8qn/3D/H9bpHPOiMQ8rCvP3iD0BDq/KXfNRxuoHMA41c8LVot4NqK5mCDc9w15WIpmSQ/tbY4XGH9VuS2y2eoEozfV/IT85s6k5iHZkNJl5aEfSBpPaWGuZypa3ovngkOqyYP+WZiAXQbOaYK9jRFL9RYw7WKIFiIxIDe+D0eVqgqmf+Y2YrHy2MrVQXddn4z128umhOZTaedRXv8IUs/rSkmeJVIjVEiaXNZHxd6PsWV5qDQFqx7caEjEjZlKXvDrNznk6gQ2TBfJAcdPc5/2xvwaJlFy2+LeR/dJgK5MQ9MCBAPXgFuNaheg==";
  
  // identity /ndn/org/icn/USER on my machine
  /*
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
  */
  // identity /ndn/org/icn/USER on memoria
  var trustAnchorBase64 = "Bv0DCQdBCANuZG4IA29yZwgDaWNuCARVU0VSCANLRVkIEWtzay0xNDQyNDQzOTk3\
MDU1CAdJRC1DRVJUCAn9AAABT9hcsC8UAxgBAhX9AXowggF2MCIYDzIwMTUwOTE2\
MjI1MzE3WhgPMjAzNTA5MTEyMjUzMTdaMCwwKgYDVQQpEyMvbmRuL29yZy9pY24v\
VVNFUi9rc2stMTQ0MjQ0Mzk5NzA1NTCCASAwDQYJKoZIhvcNAQEBBQADggENADCC\
AQgCggEBAJMr9Ncrs3yuIvhsWkyPPjcahC3UVsX5zDhB/ko6NLMA1J/j1ylCokMN\
8gFYXxiMw2cXBLbfnPu6wgE15yTNINjF/E2ZqoWJsoYYs9AA5kr0WYxUZpnrfkjV\
rIwiAZH/0h4iHSJ3Ql2s2nfF/Gv4YBaOU4/8O4AaEcvZqzsuBinMt2rR6QB1xwhA\
wmmVcuvqgg5cxDopmLDngulpGh+ubCQr2LiiFjMJ0j4sJtITBLvDTDwg3jZjdk+w\
xeqlGLblLmy1NQ25XZHf12EWmXxntvu/XfJF4jWkt7TG5YPEZDfuGtFCD3I6pv5m\
wDbI3wZEhe0tQDoHJ1bW2X47GQMJEecCAREWPRsBARw4BzYIA25kbggDb3JnCANp\
Y24IBFVTRVIIA0tFWQgRa3NrLTE0NDI0NDM5OTcwNTUIB0lELUNFUlQX/QEAgn/A\
7M2+BsagT0Wjzb0Xy5ezaYrwJupTOSrhmOBULXSgOmKF14N3rTvpCymvSqK2f7K0\
aYdDbgOn9+kpHTdcNo317EN4Xa+0oZfn95hocnB5i46OtyFIHbm7LP5t4Jd9pEhX\
kBQJtMbTzoiMFQIAyJtJuDie+Wn2NV0pzMKr1x0pMfRfZRU5RZ7TZhAUIgC4l8AZ\
5fhUHsYBad4rOY8F0RDyUrIjcUM0RiuXakx055GcGUe23XBk9uIfLsf22/fMmbam\
ELhZF4s67h2fnmbKvObRHhl0dniwnVZGo3bJh4VJcn3dmejYsGprm/Jhg42vEhf0\
obxMUa2fWOg1RwFc5g==";

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
  
  // Starts chat and join
  chronoChat = new FireChat
    (screenName, username, chatroom, 
     hubPrefix, face, keyChain, 
     onChatData, onUserLeave, onUserJoin, updateRoster, 
     true, false);
  
  // UI initialization
  $("#chatBtn").click(function () {
    sendMessageClick();
  });

  $("#installCertBtn").click(function () {
    var signedCertString = $("#signedCertString").val();
    var certificate = new IdentityCertificate();
    certificate.wireDecode(new Buffer(signedCertString, "base64"));
    chronoChat.keyChain.installIdentityCertificate(certificate, function() {
      console.log("Cert installation ready.");
      if (installCertDialog.dialog("isOpen")) {
        installCertDialog.dialog("close");
      }
    });
  });

  $("#chatTextInput").keyup(function (e) {
    if (e.keyCode == $.ui.keyCode.ENTER) {
      sendMessageClick();
    }
  });
  
  // Note: BeforeUnload event may not work in Opera;
  $(window).bind('beforeunload', function(e) {
    try {
      chronoChat.leave();
    } catch (e) {
      console.log(e);
    }
  });

  $("#openShowCertDialogBtn").click(function () {
    showCertDialog.dialog("open");
  });

  $("#openInstallCertDialogBtn").click(function () {
    installCertDialog.dialog("open");
  });

  enabled = true;
}

function sendMessageClick() {
  var chatMsg = $("#chatTextInput").val();
  if (chatMsg != "") {
    // Encode special html characters to avoid script injection.
    var escaped_msg = $('<div/>').text(chatMsg).html();

    chronoChat.send(escaped_msg);
    $("#chatTextInput").val("");
  }
  else
    alert("Message cannot be empty");
}

/************************************************
 * UI callbacks for FireChat
 ************************************************/

function onUserLeave(from, time, msg, verified) {
  var para = document.createElement("P");
  // verified undefined meaning it comes from self
  var additionalClass = "verified";
  if (verified === false) {
    additionalClass = "unverified";
  }
  $(para).addClass(additionalClass);
  para.innerHTML = '<span>' + from + '-' + (new Date(time)).toLocaleTimeString() + '</span>: Leave';
  para.onDataTimestamp = time;
  appendElement(para);
}

function onChatData(from, time, msg, verified) {
  var para = document.createElement("P");
  // verified undefined meaning it comes from self
  var additionalClass = "verified";
  if (verified === false) {
    additionalClass = "unverified";
  }
  $(para).addClass(additionalClass);
  para.innerHTML = '<span>' + from + '-' + (new Date(time)).toLocaleTimeString() + ':</span><br> ' + msg;
  para.onDataTimestamp = time;
  appendElement(para);
}

function onUserJoin(from, time, msg, verified) {
  var para = document.createElement("P");
  // verified undefined meaning it comes from self
  var additionalClass = "verified";
  if (verified === false) {
    additionalClass = "unverified";
  }
  $(para).addClass(additionalClass);
  para.innerHTML = '<span>' + from + '-' + (new Date(time)).toLocaleTimeString() + '</span>: Join';
  para.onDataTimestamp = time;
  appendElement(para);
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

/************************************************
 * Helper functions
 ************************************************/

function appendElement(para) {
  var objDiv = document.getElementById("chatDisplayDiv");
  for (var i = 0; i < objDiv.children.length; i++) {
    if (para.onDataTimestamp < objDiv.children[i].onDataTimestamp) {
      objDiv.insertBefore(para, objDiv.children[i]);
      return;
    }
  }
  objDiv.appendChild(para);
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
