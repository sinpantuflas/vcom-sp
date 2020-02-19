let heading = document.querySelector('h1');
heading.textContent = 'CLICK ANYWHERE TO START'
//document.body.onclick = init;
//this.onclick=null;
//document.body.addEventListener('click', init(), true})
document.body.addEventListener("click", init, {once: true});

function init() {
  heading.textContent = 'Voice-change-O-matic';

  // Older browsers might not implement mediaDevices at all, so we set an empty object first
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }


  // Some browsers partially implement mediaDevices. We can't just assign an object
  // with getUserMedia as it would overwrite existing properties.
  // Here, we will just add the getUserMedia property if it's missing.
  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function(constraints) {

      // First get ahold of the legacy getUserMedia, if present
      var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

      // Some browsers just don't implement it - return a rejected promise with an error
      // to keep a consistent interface
      if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
      }

      // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
      return new Promise(function(resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    }
  }



  // set up forked web audio context, for multiple browsers
  // window. is needed otherwise Safari explodes

  var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  var voiceSelect = document.getElementById("voice");
  var source;
  var stream;

  // grab the mute button to use below
  var peakText = document.getElementById("peakInfo");
  var peakText2 = document.getElementById("peakInfo2");

  var mute = document.querySelector('.mute');

  // grab the record controls
  var rec = document.querySelector('.rec');


  //set up the different audio nodes we will use for the app

  var analyser1 = audioCtx.createAnalyser();
  analyser1.minDecibels = -90;
  analyser1.maxDecibels = -10;
  analyser1.smoothingTimeConstant = 0.85;

  var analyser2 = audioCtx.createAnalyser();
  analyser2.minDecibels = -90;
  analyser2.maxDecibels = -10;
  analyser2.smoothingTimeConstant = 0.85;

  var distortion = audioCtx.createWaveShaper();
  var gainNode = audioCtx.createGain();
  var biquadFilter = audioCtx.createBiquadFilter();
  var convolver = audioCtx.createConvolver();

  var preGain = audioCtx.createGain();

  // distortion curve for the waveshaper, thanks to Kevin Ennis
  // http://stackoverflow.com/questions/22312841/waveshaper-node-in-webaudio-how-to-emulate-distortion

  function makeDistortionCurve(amount) {
    var k = typeof amount === 'number' ? amount : 50,
      n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180,
      i = 0,
      x;
    for ( ; i < n_samples; ++i ) {
      x = i * 2 / n_samples - 1;
      curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
    }
    return curve;
  };

  // grab audio track via XHR for convolver node

  var soundSource;

  ajaxRequest = new XMLHttpRequest();

  ajaxRequest.open('GET', 'https://mdn.github.io/voice-change-o-matic/audio/concert-crowd.ogg', true);

  ajaxRequest.responseType = 'arraybuffer';


  ajaxRequest.onload = function() {
    var audioData = ajaxRequest.response;

    audioCtx.decodeAudioData(audioData, function(buffer) {
        soundSource = audioCtx.createBufferSource();
        convolver.buffer = buffer;
      }, function(e){ console.log("Error with decoding audio data" + e.err);});

    //soundSource.connect(audioCtx.destination);
    //soundSource.loop = true;
    //soundSource.start();
  };

  ajaxRequest.send();

  // set up canvas context for visualizer

  var canvas = document.querySelector('.visualizer');
  var canvasCtx = canvas.getContext("2d");

  var intendedWidth = document.querySelector('.wrapper').clientWidth;

  canvas.setAttribute('width',intendedWidth);

  var visualSelect = document.getElementById("visual");

  var drawVisual;

  //main block for doing the audio recording

  if (navigator.mediaDevices.getUserMedia) {
     console.log('getUserMedia supported.');
     var constraints = {audio: true}
     navigator.mediaDevices.getUserMedia (constraints)
        .then(
          function(stream) {
             source = audioCtx.createMediaStreamSource(stream);
             //source2 = audioCtx.createMediaStreamSource(stream);
             source.connect(preGain);
             //source2.connect(analyser1);
             preGain.connect(distortion);
             //analyser1.connect(distortion);
             distortion.connect(biquadFilter);
             biquadFilter.connect(gainNode);
             convolver.connect(gainNode);
             gainNode.connect(analyser2);
             analyser2.connect(audioCtx.destination);

             showPeakF();
          	 visualize();
             voiceChange();
        })
        .catch( function(err) { console.log('The following gUM error occured: ' + err);})
  } else {
     console.log('getUserMedia not supported on your browser!');
  }

  function showPeakF(){
   analyser1.fftSize = 256;
   var bufferLengthAlt2 = analyser1.frequencyBinCount;
   console.log(bufferLengthAlt2);
   var dataArrayAlt2 = new Uint8Array(bufferLengthAlt2);
   analyser1.getByteFrequencyData(dataArrayAlt2);
   var pkT=Math.max.apply(null,dataArrayAlt2);
   function indexOfMax(arr) {
     if (arr.length === 0) {
         return -1;
     }
     var max = arr[0];
     var maxIndex = 0;
     for (var i = 1; i < arr.length; i++) {
         if (arr[i] > max) {
             maxIndex = i;
             max = arr[i];
         }
     }
     return maxIndex;
    }
    var pkTi = indexOfMax(dataArrayAlt2);
    var binWidth = (22050 / bufferLengthAlt2);
    peakText2.value = (pkTi*binWidth).toFixed(2);
  //
  console.log("!");
  }

  function visualize() {
    WIDTH = canvas.width;
    HEIGHT = canvas.height;


    var visualSetting = visualSelect.value;
    console.log(visualSetting);

    if(visualSetting === "sinewave") {
      analyser2.fftSize = 2048;
      var bufferLength = analyser2.fftSize;
      console.log(bufferLength);
      var dataArray = new Uint8Array(bufferLength);

      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

      var draw = function() {

        drawVisual = requestAnimationFrame(draw);

        analyser2.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = 'rgb(200, 200, 200)';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

        canvasCtx.beginPath();

        var sliceWidth = WIDTH * 1.0 / bufferLength;
        var x = 0;

        for(var i = 0; i < bufferLength; i++) {

          var v = dataArray[i] / 128.0;
          var y = v * HEIGHT/2;

          if(i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height/2);
        canvasCtx.stroke();
      };

      draw();

    } else if(visualSetting == "frequencybars") {
      analyser2.fftSize = 4096;
      var bufferLengthAlt = analyser2.frequencyBinCount;
      console.log(bufferLengthAlt);
      var dataArrayAlt = new Uint8Array(bufferLengthAlt);

      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

      var drawAlt = function() {
        drawVisual = requestAnimationFrame(drawAlt);

        analyser2.getByteFrequencyData(dataArrayAlt);

  //
          var pkT=Math.max.apply(null,dataArrayAlt);
          function indexOfMax(arr) {
            if (arr.length === 0) {
                return -1;
            }

            var max = arr[0];
            var maxIndex = 0;

            for (var i = 1; i < arr.length; i++) {
                if (arr[i] > max) {
                    maxIndex = i;
                    max = arr[i];
                }
            }

            return maxIndex;
          }
          var pkTi = indexOfMax(dataArrayAlt);

          var binWidth = (22050 / bufferLengthAlt);
          peakText.value = (pkTi*binWidth).toFixed(2);

        canvasCtx.fillStyle = 'rgb(0, 0, 0)';
        canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        var barWidth = (WIDTH / bufferLengthAlt) * 2.5;
        var barHeight;
        var x = 0;

        for(var i = 0; i < bufferLengthAlt; i++) {
          barHeight = dataArrayAlt[i];

          canvasCtx.fillStyle = 'rgb(' + (barHeight+100) + ',50,50)';
          canvasCtx.fillRect(x,HEIGHT-barHeight/2,barWidth,barHeight/2);

          x += barWidth + 1;
        }
      };

      drawAlt();

    } else if(visualSetting == "off") {
      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
      canvasCtx.fillStyle = "red";
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
    }

  }

  function voiceChange() {

    distortion.oversample = '4x';
    biquadFilter.gain.setTargetAtTime(0, audioCtx.currentTime, 0)

    var voiceSetting = voiceSelect.value;
    console.log(voiceSetting);

    //when convolver is selected it is connected back into the audio path
    if(voiceSetting == "convolver") {
      biquadFilter.disconnect(0);
      biquadFilter.connect(convolver);
    } else {
      biquadFilter.disconnect(0);
      biquadFilter.connect(gainNode);

      if(voiceSetting == "distortion") {
        distortion.curve = makeDistortionCurve(400);
      } else if(voiceSetting == "biquad") {
        biquadFilter.type = "lowshelf";
        biquadFilter.frequency.setTargetAtTime(1000, audioCtx.currentTime, 0)
        biquadFilter.gain.setTargetAtTime(25, audioCtx.currentTime, 0)
      } else if(voiceSetting == "off") {
        console.log("Voice settings turned off");
      }
    }
  }

  // event listeners to change visualize and voice settings

  visualSelect.onchange = function() {
    window.cancelAnimationFrame(drawVisual);
    visualize();
  };

  voiceSelect.onchange = function() {
    voiceChange();
  };

  mute.onclick = voiceMute;

  function voiceMute() {
    if(mute.id === "") {
      gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0)
      mute.id = "activated";
      mute.innerHTML = "Unmute Output";
    } else {
      gainNode.gain.setTargetAtTime(1, audioCtx.currentTime, 0)
      mute.id = "";
      mute.innerHTML = "Mute Output";
    }
  }

  // Record and stop controls
  rec.onclick = voiceRecord;
  function voiceRecord(){
    if(rec.id === "") {
      preGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0)
      rec.id = "activated";
      rec.innerHTML = "Record";
    } else {
      preGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0)
      rec.id = "";
      rec.innerHTML = "Stop Recording";
    }
  }

}
