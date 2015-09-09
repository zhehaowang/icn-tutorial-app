var IndexedDbChatStorage = function IndexedDbChatStorage(dbName)
{
  if (typeof Dexie !== 'undefined') {
    this.database = new Dexie(dbName);

    this.database.version(1).stores({
      // A table for global values. It currently only has the defaultIdentityUri.
      // "name" is the key here (uri string)
      // "content" is the ndn data packet, UInt8Array generated from default encoding
      messages: "name"
    });
    this.database.open().catch(function(error){
      console.log("Dexie DB opening error: " + error);
    });
    //this.database.delete();
  } else {
    console.log("Dexie not defined for persistent storage.");
  }
};

IndexedDbChatStorage.prototype.addData = function(data) {
  var content = new Blob(data.wireEncode()).buf();
  this.database.messages.put({"name": data.getName().toUri(), "content": content});
};