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
var syncTreeDialog;

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

  syncTreeDialog = $("#sync-tree-dialog").dialog({
    title: "Sync tree",
    autoOpen: false,
    buttons: {
      "OK": function () {
        $(this).dialog("close");
      }
    },
    open: function () {
      // TODO: This assumes knowledge of the library's data structure      
      var digestTree = chronoChat.sync.digest_tree;
      var rootDigest = digestTree.getRoot().substring(0, 6);
      var syncTreeJson = {
        "name": rootDigest,
        "parent": "null",
        "children": []
      };

      for (var i = 0; i < digestTree.digestnode.length; i++) {
        syncTreeJson.children.push({
          // TODO: Hardcoded for now, change later
          "name": new Name(digestTree.digestnode[i].getDataPrefix()).get(4).toEscapedString() + "-"
             + digestTree.digestnode[i].getSessionNo() + " : "
             + digestTree.digestnode[i].getSequenceNo().toString(),
          "parent": rootDigest
        });
      }
      updateSyncTree(syncTreeJson);
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
  var chatroom = "more";
  
  // Starts chat and join
  chronoChat = new FireChat
    (screenName, username, chatroom, 
     onChatData, onUserLeave, onUserJoin, updateRoster, onChatDataVerified, 
     true, false);

  $("#userInfo").html("Chatroom : " + chatroom + "<br> User: " + screenName + " (" + username + ")");
  $("#chatroomNameLabel").html(chatroom);

  // UI initialization
  $("#chatBtn").click(function () {
    sendMessageClick();
  });

  $("#installCertBtn").click(function () {
    var signedCertString = $("#signedCertString").val();
    var certificate = new IdentityCertificate();
    certificate.wireDecode(new Buffer(signedCertString, "base64"));
    chronoChat.keyChain.installIdentityCertificate(certificate, function () {
      console.log("Cert installation ready.");
      if (installCertDialog.dialog("isOpen")) {
        installCertDialog.dialog("close");
      }
    }, function (error) {
      console.log("Error in installIdentityCertificate: " + error);
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

  $("#showSyncTreeDialogBtn").click(function () {
    syncTreeDialog.dialog("open");
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

function onUserLeave(from, time, msg, verified, name, session, seqNo) {
  var para = document.createElement("P");
  // verified undefined meaning it comes from self
  var additionalClass = "verified";
  if (verified === false) {
    additionalClass = "unverified";
    $(para).attr("id", name + session + seqNo.toString());
  }
  $(para).addClass(additionalClass);
  para.innerHTML = '<span>' + from + '-' + (new Date(time)).toLocaleTimeString() + '</span>: Leave';
  para.onDataTimestamp = time;
  appendElement(para);
}

function onChatData(from, time, msg, verified, name, session, seqNo) {
  var para = document.createElement("P");
  // verified bool undefined meaning it comes from self
  var additionalClass = "verified";
  // we only need ids for those that are marked explicitly as unverified
  if (verified === false) {
    additionalClass = "unverified";
    $(para).attr("id", name + session + seqNo.toString());
  }
  $(para).addClass(additionalClass);

  var escaped_msg = $('<div/>').text(msg).html();
  para.innerHTML = '<span>' + from + '-' + (new Date(time)).toLocaleTimeString() + ':</span><br> ' + msg;
  para.onDataTimestamp = time;
  appendElement(para);
}

/**
 * user join callback to pass into FireChat class
 * @param {String} from The screen name of the user that joined
 * @param {Number} time The receive time of join message
 * @param {String} msg The message that comes with the join message, ignored
 * @param {Bool} verified Since we decided to move this out of onVerified to onData, other user join will always be unverified
 * @param {String} name The user name of the user that joined
 * @param {String} session The session name of the user that joined
 * @param {Number} seqNo The sequence number of this join message; this concatenated with name and session is used to identify an html element if needed
 */
function onUserJoin(from, time, msg, verified, name, session, seqNo) {
  var para = document.createElement("P");
  // verified undefined meaning it comes from self
  var additionalClass = "verified";
  if (verified === false) {
    additionalClass = "unverified";
    $(para).attr("id", name + session + seqNo.toString());
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

function onChatDataVerified(name, session, seqNo) {
  var elementIdStr = name + session + seqNo.toString();
  var para = document.getElementById(elementIdStr);
  if (para) {
    $(para).removeClass("unverified");
    $(para).addClass("verified");
  }
}

/************************************************
 * Helper functions
 ************************************************/

function appendElement(para) {
  var objDiv = document.getElementById("chatDisplayDiv");
  for (var i = 0; i < objDiv.children.length; i++) {
    if (para.onDataTimestamp < objDiv.children[i].onDataTimestamp) {
      objDiv.insertBefore(para, objDiv.children[i]);
      document.getElementById("chatDisplayWrapper").scrollTop = document.getElementById("chatDisplayWrapper").scrollHeight;
      return;
    }
  }
  objDiv.appendChild(para);
  document.getElementById("chatDisplayWrapper").scrollTop = document.getElementById("chatDisplayWrapper").scrollHeight;
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

/************************************************
 * D3 sync tree render function
 ************************************************/
function updateSyncTree(source) {
  $("#sync-tree").html("");

  var margin = {top: 20, right: 120, bottom: 20, left: 120},
  width = 1280 - margin.right - margin.left,
  height = 500 - margin.top - margin.bottom;

  var tree = d3.layout.tree()
    .size([height, width]);

  var diagonal = d3.svg.diagonal()
    .projection(function(d) { return [d.y, d.x]; });

  var svg = d3.select("#sync-tree").append("svg")
    .attr("width", width + margin.right + margin.left)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var i = 0;

  // Compute the new tree layout.
  var nodes = tree.nodes(source).reverse(),
    links = tree.links(nodes);

  // Normalize for fixed-depth.
  nodes.forEach(function(d) { d.y = d.depth * 180; });

  // Declare the nodes…
  var node = svg.selectAll("g.node")
    .data(nodes, function(d) { return d.id || (d.id = ++i); });

  // Enter the nodes.
  var nodeEnter = node.enter().append("g")
    .attr("class", "node")
    .attr("transform", function(d) { 
      return "translate(" + d.y + "," + d.x + ")"; });

  nodeEnter.append("circle")
    .attr("r", 10)
    .style("fill", "#fff");

  nodeEnter.append("text")
    .attr("x", function(d) { 
      return d.children || d._children ? -13 : 13; })
    .attr("dy", ".35em")
    .attr("text-anchor", function(d) { 
      return d.children || d._children ? "end" : "start"; })
    .text(function(d) { return d.name; })
    .style("fill-opacity", 1);

  // Declare the links…
  var link = svg.selectAll("path.link")
    .data(links, function(d) { return d.target.id; });

  // Enter the links.
  link.enter().insert("path", "g")
    .attr("class", "link")
    .attr("d", diagonal);

}
