# icn-tutorial-app

Sync based chat/multimedia app with signing/verification for ICN tutorial.

Email: Zhehao Wang <zhehao@remap.ucla.edu>

### Online trial

Please try the app out at: http://memoria.ndn.ucla.edu/icn-tutorial/icn-torial-app (For now, please use Firefox only; tested with 40 and 41)

Please request a certificate at: http://memoria.ndn.ucla.edu:5000 (For now, please ignore the instructions there, and follow the steps in this document)

### How to use

1. Provide an email and nickname, and join the default channel; (Random string or nickname will be generated if left empty)
2. Get certified (similar as ndncert): 
..* Open [this link](http://memoria.ndn.ucla.edu:5000) and put in your email
..* Check your email for a link from testname.zhehao@gmail.com, go to that link
..* Go back to chat page, click the tools button on the top right corner, click "Request certificate"
..* Copy the base64 string from the prompted dialog and paste it to the certificate field in the above-opened link
..* Make sure you've put in certificate and username field, and submit
..* The cert should be automatically issued and emailed to your email account; it's up to you to install it in browser (by clicking the "install signed cert" button), or let memoria keep and serve your signed cert.
⋅⋅⋅You can use the online demo without getting certified, but the messages will be marked in a different color, and it will take much longer for the messages to get displayed. (Other participant keeps trying to verify)
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

Dependencies include: 
* ndn-js (latest version Sept 16), 
* jquery (using 1.11), 
* jquery ui, 
* dexie; Expects IndexedDB support from browser

Please refer to [this repository](https://github.com/zhehaowang/openmhealth-cert/tree/icn-cert-deployment) for details of the cert site, currently being updated

### Known Issues

Currently working on:
* Interest re-expression onTimeout, believed to cause multiple join/leaves without actual user behavior
* Display unverified messages with less delay?
* Caching leave messages when user not leaving gracefully?
* Support for later versions of Chrome, which requires a secure source (or https deployment); createIdentityCertificate likely throws this exception, investigating
* Feature support, for example multimedia
* UI improvements