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
 * NOTE: this add adds a timestamp used specifically for chat app, may want to change that.
 */
IndexedDbChatStorage.prototype.add = function(data, onAdd) 
{
  // In Firefox, transaction not complete error occurs onPageReload; said to be fixed in Firefox 41
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1147942
  var content = new Blob(data.wireEncode()).buf();

  this.database.messages.put({"name": data.getName().toUri(), "content": content, "timestamp": (new Date()).getTime()}).then(function(param) {
    //console.log("Appended content " + data.getContent().toString());
    // TODO: look up param list for the then of the promise returned by put
    if (onAdd !== undefined) {
      onAdd(param);
    }
  }).catch(function (error) {
    console.log(error);
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
  return this.database.delete();
};

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

IndexedDbChatStorage.prototype.get = function(matchStr)
{
  this.database.messages.get(matchStr, function(item) {
    return item;
  });
}