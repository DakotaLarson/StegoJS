(function(){
    let fileInput = document.querySelector('#file');
    let encBtn = document.querySelector('.encBtn');
    let decBtn = document.querySelector('.decBtn');
    let passInput = document.querySelector('.passInput');
    let msgInput = document.querySelector('.msgInput');
    let err = document.querySelector('.err');
    let imageData = undefined;
    let bitsAvailable = 0;
    fileInput.addEventListener('change', function(event){
        let files = event.target.files;
        if(files.length === 0){

        }else if(files.length > 1){

        }else{
            let file = files[0];
            let reader = new FileReader();
            reader.onload = function(event){
                let url = event.target.result;
                let img = new Image();
                img.onload = function(){
                    let canvas = document.createElement('canvas');
                    let height = img.height;
                    let width = img.width;
                    canvas.height = height;
                    canvas.width = width;
                    let context = canvas.getContext('2d');
                    context.drawImage(img, 0, 0);
                    bitsAvailable = 0;
                    imageData = context.getImageData(0, 0, canvas.width, canvas.height);
                    for(let i = 0; i < height * width; i ++){
                        if(imageData.data[4 * i + 3] === 255){
                            for(let j = 0; j < 3; j ++){
                                if(imageData.data[4 * i + j] < 254){
                                    bitsAvailable ++;
                                }
                            }
                        }
                    }
                    console.log('Image processed | ' + bitsAvailable + ' bits available');
                };
                img.src = url;
            };
            reader.readAsDataURL(file);
        }
    });
    encBtn.addEventListener('click', function(){
        let msg = msgInput.value.trim();
        if(!msg){
            err.textContent = 'No message supplied';
        }else if(!imageData){
            err.textContent = 'No image supplied';
        }else{
            err.textContent = '';
            Math.seedrandom(passInput.value);

        }
    });
    decBtn.addEventListener('click', function(){

    });
    function ab2str(buf) {
        return String.fromCharCode.apply(null, new Uint16Array(buf));
    }
    function str2ab(str) {
        let buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
        let bufView = new Uint16Array(buf);
        for (let i=0, strLen=str.length; i < strLen; i++) {
            bufView[i] = str.charCodeAt(i);
        }
        return buf;
    }
    let rawKey = 'test key';
    let data = 'test data';
    window.crypto.subtle.importKey('raw', str2ab(rawKey),{
        name: 'AES-GCM'
    }, true, ['encrypt', 'decrypt']).then(function(key){
        console.log(key);
        window.crypto.subtle.exportKey('raw', key).then(function(keyData){
            console.log(keyData);
        });
        encrypt(key, data);
    });
    function encrypt(key, data){
        let iv = window.crypto.getRandomValues(new Uint8Array(12));
        window.crypto.subtle.encrypt({
            name: 'AES-GCM',
            iv: iv
        }, key, str2ab(data)).then(function(encrypted){
            console.log(encrypted);
        });
    }
    function decrypt(key, data, iv){
        window.subtle.decrypt({
            name: 'AES-GCM',
            iv: iv
        })
    }
}());