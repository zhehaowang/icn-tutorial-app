var IndexedDbChatStorage = function IndexedDbChatStorage(dbName, face)
{
  if (typeof Dexie !== 'undefined') {
    this.database = new Dexie(dbName);

    this.database.version(1).stores({
      // "name" is the key here (uri string)
      // "content" is the ndn data packet, UInt8Array generated from default encoding
      messages: "name"
    });
    this.database.open().catch(function(error){
      console.log("Dexie DB opening error: " + error);
    });
  } else {
    console.log("Dexie not defined for persistent storage.");
  }

  this.face = face;

  this.onDataNotFoundForPrefix = {};
  this.registeredPrefixIdList = []; 
};

/**
 * IndexedDbChatStorage tries to provide an interface similar to that of memoryContentCache
 */
IndexedDbChatStorage.prototype.add = function(data) 
{
  var content = new Blob(data.wireEncode()).buf();
  this.database.messages.put({"name": data.getName().toUri(), "content": content}).then(function() {
    
  });
};

IndexedDbChatStorage.prototype.registerPrefix = function(prefix, onRegisterFailed, onDataNotFound, flags, wireFormat) 
{
  if (onDataNotFound) {
    this.onDataNotFoundForPrefix[prefix.toUri()] = onDataNotFound;
  }
  var registeredPrefixId = this.face.registerPrefix
    (prefix, this.onInterest.bind(this), onRegisterFailed, flags, wireFormat);
  this.registeredPrefixIdList.push(registeredPrefixId);
};

IndexedDbChatStorage.prototype.delete = function() 
{
  this.database.delete();
}

IndexedDbChatStorage.prototype.unregisterAll = function()
{
  for (var i = 0; i < this.registeredPrefixIdList.length; ++i)
    this.face.removeRegisteredPrefix(this.registeredPrefixIdList[i]);
  this.registeredPrefixIdList = [];

  // Also clear each onDataNotFoundForPrefix given to registerPrefix.
  this.onDataNotFoundForPrefix = {};
};

// For now, onInterest only does exact name uri string match
IndexedDbChatStorage.prototype.onInterest = function(prefix, interest, face, interestFilterId, filter)
{
  var matchStr = interest.getName().toUri();
  var self = this;
  this.database.messages.get(matchStr, function(item) {
    if (item !== undefined) {
      var data = new Data();
      data.wireDecode(new Blob(item.content));
      self.face.putData(data); 
    } else {
      var onDataNotFound = self.onDataNotFoundForPrefix[prefix.toUri()];
      if (onDataNotFound) {
        onDataNotFound(prefix, interest, face, interestFilterId, filter);
      }
    }
  })
}