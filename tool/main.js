// initialize
window.onload = function() {
    // add action to the file input
    let input = document.getElementById('file');
    input.addEventListener('change', importImage);

    // add action to the encode button
    let encodeButton = document.getElementById('encode');
    encodeButton.addEventListener('click', encode);

    // add action to the decode button
    let decodeButton = document.getElementById('decode');
    decodeButton.addEventListener('click', decode);
};

// artificially limit the message size
let maxMessageSize = 1000;

// put image in the canvas and display it
let importImage = function(e) {
    let reader = new FileReader();

    reader.onload = function(event) {
        // set the preview
        document.getElementById('preview').style.display = 'block';
        document.getElementById('preview').src = event.target.result;

        // wipe all the fields clean
        document.getElementById('message').value = '';
        document.getElementById('password').value = '';
        document.getElementById('password2').value = '';
        document.getElementById('messageDecoded').innerHTML = '';

        // read the data into the canvas element
        let img = new Image();
        img.onload = function() {
            let ctx = document.getElementById('canvas').getContext('2d');
            ctx.canvas.width = img.width;
            ctx.canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            decode();
        };
        img.src = event.target.result;
    };

    reader.readAsDataURL(e.target.files[0]);
};

// encode the image and save it
let encode = function() {
    let message = document.getElementById('message').value;
    let password = document.getElementById('password').value;
    let output = document.getElementById('output');
    let canvas = document.getElementById('canvas');
    let ctx = canvas.getContext('2d');

    // encrypt the message with supplied password if necessary
    if (password.length > 0) {
        message = sjcl.encrypt(password, message);
    } else {
        message = JSON.stringify({'text': message});
    }

    // exit early if the message is too big for the image
    let pixelCount = ctx.canvas.width * ctx.canvas.height;
    if ((message.length + 1) * 16 > pixelCount * 4 * 0.75) {
        alert('Message is too big for the image.');
        return;
    }

    // exit early if the message is above an artificial limit
    if (message.length > maxMessageSize) {
        alert('Message is too big.');
        return;
    }

    // encode the encrypted message with the supplied password
    let imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    encodeMessage(imgData.data, sjcl.hash.sha256.hash(password), message);
    ctx.putImageData(imgData, 0, 0);

    output.src = canvas.toDataURL();

};

// decode the image and display the contents if there is anything
let decode = function() {
    let password = document.getElementById('password2').value;
    let passwordFail = 'Password is incorrect or there is nothing here.';

    // decode the message with the supplied password
    let ctx = document.getElementById('canvas').getContext('2d');
    let imgData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    let message = decodeMessage(imgData.data, sjcl.hash.sha256.hash(password));

    // try to parse the JSON
    let obj = null;
    try {
        obj = JSON.parse(message);
    } catch (e) {
        // display the "choose" view

        document.getElementById('choose').style.display = 'block';
        document.getElementById('reveal').style.display = 'none';

        if (password.length > 0) {
            alert(passwordFail);
        }
    }

    // display the "reveal" view
    if (obj) {
        document.getElementById('choose').style.display = 'none';
        document.getElementById('reveal').style.display = 'block';

        // decrypt if necessary
        if (obj.ct) {
            try {
                obj.text = sjcl.decrypt(password, message);
            } catch (e) {
                alert(passwordFail);
            }
        }

        // escape special characters
        let escChars = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            '\'': '&#39;',
            '/': '&#x2F;',
            '\n': '<br/>'
        };
        let escHtml = function(string) {
            return String(string).replace(/[&<>"'\/\n]/g, function (c) {
                return escChars[c];
            });
        };
        document.getElementById('messageDecoded').innerHTML = escHtml(obj.text);
    }
};

// returns a 1 or 0 for the bit in 'location'
let getBit = function(number, location) {
   return ((number >> location) & 1);
};

// sets the bit in 'location' to 'bit' (either a 1 or 0)
let setBit = function(number, location, bit) {
   return (number & ~(1 << location)) | (bit << location);
};

// returns an array of 1s and 0s for a 2-byte number
let getBitsFromNumber = function(number) {
   let bits = [];
   for (let i = 0; i < 16; i++) {
       bits.push(getBit(number, i));
   }
   return bits;
};

// returns the next 2-byte number
let getNumberFromBits = function(bytes, history, hash) {
    let number = 0, pos = 0;
    while (pos < 16) {
        let loc = getNextLocation(history, hash, bytes.length);
        let bit = getBit(bytes[loc], 0);
        number = setBit(number, pos, bit);
        pos++;
    }
    return number;
};

// returns an array of 1s and 0s for the string 'message'
let getMessageBits = function(message) {
    let messageBits = [];
    for (let i = 0; i < message.length; i++) {
        let code = message.charCodeAt(i);
        messageBits = messageBits.concat(getBitsFromNumber(code));
    }
    return messageBits;
};

// gets the next location to store a bit
let getNextLocation = function(history, hash, total) {
    let pos = history.length;
    let loc = Math.abs(hash[pos % hash.length] * (pos + 1)) % total;
    while (true) {
        if (loc >= total) {
            loc = 0;
        } else if (history.indexOf(loc) >= 0) {
            loc++;
        } else if ((loc + 1) % 4 === 0) { //Check for if value relates to alpha
            loc++;
        } else {
            history.push(loc);
            return loc;
        }
    }
};

// encodes the supplied 'message' into the CanvasPixelArray 'colors'
let encodeMessage = function(colors, hash, message) {
    // make an array of bits from the message
    let messageBits = getBitsFromNumber(message.length);
    messageBits = messageBits.concat(getMessageBits(message));

    // this will store the color values we've already modified
    let history = [];

    // encode the bits into the pixels
    let pos = 0;
    while (pos < messageBits.length) {
        // set the next color value to the next bit
        let loc = getNextLocation(history, hash, colors.length);
        colors[loc] = setBit(colors[loc], 0, messageBits[pos]);

        // set the alpha value in this pixel to 255
        // we have to do this because browsers do premultiplied alpha
        // see for example: http://stackoverflow.com/q/4309364
        while ((loc + 1) % 4 !== 0) {
            loc++;
        }
        colors[loc] = 255;

        pos++;
    }
};

// returns the message encoded in the CanvasPixelArray 'colors'
let decodeMessage = function(colors, hash) {
    // this will store the color values we've already read from
    let history = [];

    // get the message size
    let messageSize = getNumberFromBits(colors, history, hash);

    // exit early if the message is too big for the image
    if ((messageSize + 1) * 16 > colors.length * 0.75) {
        return '';
    }

    // exit early if the message is above an artificial limit
    if (messageSize === 0 || messageSize > maxMessageSize) {
        return '';
    }

    // put each character into an array
    let message = [];
    for (let i = 0; i < messageSize; i++) {
        let code = getNumberFromBits(colors, history, hash);
        message.push(String.fromCharCode(code));
    }

    // the characters should parse into valid JSON
    return message.join('');
};
