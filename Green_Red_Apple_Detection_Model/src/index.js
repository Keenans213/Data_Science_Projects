import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import * as tf from '@tensorflow/tfjs';
import {loadGraphModel} from '@tensorflow/tfjs-converter';
import "./styles.css";
tf.setBackend('webgl');

const App = () => {
  
  const video = useRef(null);
  const canvas = useRef(null);

  const threshold = 0.01;

  const load_model = async () => {
    const model = await loadGraphModel("http://127.0.0.1:8080/model.json")
    return model
  }
  
  let classesDir = {
      1: {
          name: 'red',
          id: 1,
      },
      2: {
          name: 'green',
          id: 2,
      }
  }

  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const webCamPromise = navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: { facingMode: "user" }
        })
        .then(stream => {
          window.stream = stream;
          video.current.srcObject = stream;
          return new Promise((resolve, reject) => {
            video.current.onloadedmetadata = () => {
              resolve();
            };
          });
        });

      const modelPromise = load_model();

      Promise.all([modelPromise, webCamPromise])
        .then(values => {
          detectFrame(video.current, values[0]);
        })
        .catch(error => {
          console.error(error);
        });
    }
  }, []);

  const detectFrame = (video, model) => {
    tf.engine().startScope();
    model.executeAsync(process_input(video))
      .then(predictions => {
        renderPredictions(predictions);
        requestAnimationFrame(() => {
          detectFrame(video, model);
        });
        tf.engine().endScope();
      });
  };

  const process_input = (video_frame) => {
    const tfimg = tf.browser.fromPixels(video_frame).toInt();
    const expandedimg = tfimg.transpose([0,1,2]).expandDims();
    return expandedimg;
  };

  const buildDetectedObjects = (scores, threshold, boxes, classes, classesDir) => {
    const detectionObjects = []
    var video_frame = document.getElementById('frame');
    
    scores[0].forEach((score, i) => {
      if (score > threshold) {
        const bbox = [];
        console.log(video_frame.offsetHeight)
        console.log(video_frame.offsetWidth)
        const minY = boxes[0][i][0] * video_frame.offsetHeight;
        const minX = boxes[0][i][1] * video_frame.offsetWidth;
        const maxY = boxes[0][i][2] * video_frame.offsetHeight;
        const maxX = boxes[0][i][3] * video_frame.offsetWidth;
        bbox[0] = minX;
        bbox[1] = minY;
        bbox[2] = maxX - minX;
        bbox[3] = maxY - minY;
        detectionObjects.push({
          class: classes[i],
          label: classesDir[classes[i]].name,
          score: score.toFixed(4), 
          bbox: bbox
        })
      }
    })
    return detectionObjects
  }

  const renderPredictions = (predictions) => {
    const ctx = canvas.current.getContext("2d"); 
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); 

    // Font options.
    const font = "16px sans-serif";
    ctx.font = font; 
    ctx.textBaseline = "top"; 

    const boxes = predictions[6].arraySync();
    const scores = predictions[7].arraySync();
    const classes = predictions[2].dataSync();
    const detections = buildDetectedObjects(scores, threshold, boxes, classes, classesDir);

    detections.forEach(item => {
      const x = item['bbox'][0];
      const y = item['bbox'][1];
      const width = item['bbox'][2];
      const height = item['bbox'][3];

      // Draw the bounding box.
      if (item['label'] === 'red') {
        ctx.strokeStyle = "#ff0000";
      } else {
        ctx.strokeStyle = "#00ba28";
      }
      // ctx.strokeStyle = "#ff9900"; 
      ctx.lineWidth = 4; 
      ctx.strokeRect(x, y, width, height); 

      // Draw the label background.
      if (item['label'] === 'red') {
        ctx.fillStyle = "#ff0000";
      } else {
        ctx.fillStyle = "#00ba28";
      }
      const textWidth = ctx.measureText(item["label"] + " " + (100 * item["score"]).toFixed(2) + "%").width; 
      const textHeight = parseInt(font, 10); 
      ctx.fillRect(x, y, textWidth + 4, textHeight + 4); 
    });

    detections.forEach(item => {
      const x = item['bbox'][0];
      const y = item['bbox'][1];

      // Draw the text last to ensure it's on top.
      ctx.fillStyle = "#000000";
      ctx.fillText(item["label"] + " " + (100*item["score"]).toFixed(2) + "%", x, y); // draws text on canvas starting at coordinates (x, y)
    });
  };
  
  return(
    <div>
      <video
        style={{height:"500px", width:"667px"}}
        className="size"
        autoPlay
        playsInline
        muted
        ref={video}
        width="667"
        height="500"
        id="frame"
      />
      <canvas
        className="size"
        ref={canvas}
        width="667"
        height="500"
      />
    </div>
  );
}

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);