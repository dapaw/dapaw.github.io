class DocumentScanner {
    cv;

    calculatedPoints = [];
    movedPoints = [];

    moveTL = false;
    moveTR = false;
    moveBR = false;
    moveBL = false;
    mousePosition = {x: 0, y: 0};
    scalefactore = 0

    constructor(originalimage, paintingbase, extractingbase) {
      if (!("cv" in window)) {
        throw new Error("OpenCV not found");
      }else{
        this.cv = window["cv"];
      }
      this.originalimage = originalimage;
      this.scalefactore = this.originalimage.width / this.originalimage.height;
      this.paintingbase = paintingbase;

      this.extractingbase = extractingbase;
    }

    startMoving(event) {
        console.log('start moving');
        this.mousePosition = this.getMousePoint(event);
        if (this.clickActive(this.calculatedPoints[0])) this.moveTL = true;
        if (this.clickActive(this.calculatedPoints[1])) this.moveTR = true;
        if (this.clickActive(this.calculatedPoints[2])) this.moveBR = true;
        if (this.clickActive(this.calculatedPoints[3])) this.moveBL = true;
    }

    moving(event) {
        if (this.movingShouldActive()) {
            this.mousePosition = this.getMousePoint(event);
            if (this.moveTL) {
                this.calculatedPoints[0] = this.mousePosition;
            }
            if (this.moveTR) {
                this.calculatedPoints[1] = this.mousePosition;
            }
            if (this.moveBR) {
                this.calculatedPoints[2] = this.mousePosition;
            }
            if (this.moveBL) {
                this.calculatedPoints[3] = this.mousePosition;
            }
            this.fillPaintingBase();
            this.drawPoints(this.calculatedPoints);
            console.log(this.getMousePoint(event))
        }
    }

    movingShouldActive() {
        return this.moveTL || this.moveTR || this.moveBR || this.moveBL;
    }

    stopMoving(event) {
        console.log('stop moving');
        this.moveTL = false;
        this.moveTR = false;
        this.moveBR = false;
        this.moveBL = false;
        this.mousePosition = this.getMousePoint(event);
        this.crop();
    }

    getMousePoint(event) {
        const rect = this.paintingbase.getBoundingClientRect();
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        console.log("x: " + x + " y: " + y)
        console.log(this.scalefactore)
        console.log(this.calculatedPoints)
        return {x, y};
    }  

    clickActive(point) {
        const distance = Math.hypot(point.x - this.mousePosition.x, point.y - this.mousePosition.y);
        return distance < 20;
    }
  
    detect(source){
      let cv = this.cv;
      const img = cv.imread(source);
      const gray = new cv.Mat();
      cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);
      const blur = new cv.Mat();
      cv.GaussianBlur(gray,blur,new cv.Size(5, 5),0,0,cv.BORDER_DEFAULT);
      const thresh = new cv.Mat();
      cv.threshold(blur,thresh,0,255,cv.THRESH_BINARY + cv.THRESH_OTSU);
      let contours = new cv.MatVector();
      let hierarchy = new cv.Mat();
  
      cv.findContours(thresh,contours,hierarchy,cv.RETR_CCOMP,
        cv.CHAIN_APPROX_SIMPLE);
  
      let maxArea = 0;
      let maxContourIndex = -1;
      for (let i = 0; i < contours.size(); ++i) {
        let contourArea = cv.contourArea(contours.get(i));
        if (contourArea > maxArea) {
          maxArea = contourArea;
          maxContourIndex = i;
        }
      }
  
      const maxContour = contours.get(maxContourIndex);
      const points = this.getCornerPoints(maxContour)
      img.delete();
      gray.delete();
      blur.delete();
      thresh.delete();
      contours.delete();
      hierarchy.delete();
      this.calculatedPoints = points;
    }

    fillPaintingBase() {
        this.paintingbase.width = this.originalimage.width;
        this.paintingbase.height = this.originalimage.height;
        this.paintingbase.style.maxWidth = this.originalimage.width + 'px';
        this.paintingbase.style.maxHeight = this.originalimage.height + 'px';
        const img = cv.imread(this.originalimage);
        cv.imshow(this.paintingbase, img);
    }

    drawDefaultPoints() {
        this.drawPoints(this.calculatedPoints);
    }

    drawPoints(points) {
        const ctx = this.paintingbase.getContext("2d");
        if (
            points[0] &&
            points[1] &&
            points[2] &&
            points[3]
          ) {
            ctx.strokeStyle = 'blue';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(...Object.values(points[0]));
            ctx.lineTo(...Object.values(points[1]));
            ctx.lineTo(...Object.values(points[2]));
            ctx.lineTo(...Object.values(points[3]));
            ctx.lineTo(...Object.values(points[0]));
            ctx.stroke();

            ctx.closePath();
            this.drawCorner(ctx, points[0]);
            this.drawCorner(ctx, points[1]);
            this.drawCorner(ctx, points[2]);
            this.drawCorner(ctx, points[3]);
          }
    }



    drawCorner(ctx, corner) {
        ctx.beginPath();
        ctx.strokeStyle = 'red';
        ctx.lineWidth = '5';
        ctx.arc(corner.x, corner.y, 20, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.closePath();
      }

    getCursorPosition(event) {
        const rect = this.paintingbase.getBoundingClientRect()
        const x = event.clientX - rect.left
        const y = event.clientY - rect.top
        console.log("x: " + x + " y: " + y)
    }

  
    crop(width,height){
      const cv = this.cv;
      const img = cv.imread(this.originalimage);
    
      const points = this.calculatedPoints;
      
      let warpedDst = new cv.Mat();
      if (!width) {
        width = Math.max(this.distance(points[0],points[1]),this.distance(points[2],points[3]));
      }
      if (!height) {
        height = Math.max(this.distance(points[0],points[3]),this.distance(points[1],points[2]));
      }
      let dsize = new cv.Size(width, height);
      let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        points[0].x,
        points[0].y,
        points[1].x,
        points[1].y,
        points[3].x,
        points[3].y,
        points[2].x,
        points[2].y,
      ]);
  
      let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0,
        0,
        width,
        0,
        0,
        height,
        width,
        height,
      ]);
  
      let M = cv.getPerspectiveTransform(srcTri, dstTri);
      cv.warpPerspective(img,warpedDst,M,dsize,cv.INTER_LINEAR,
        cv.BORDER_CONSTANT,
        new cv.Scalar()
      );
  
      cv.imshow(this.extractingbase, warpedDst);
      img.delete()
      warpedDst.delete()
    }
  
    distance(p1, p2) {
      return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }
  
    getCornerPoints(contour) {
      let cv = this.cv;
      let points = [];
      let rect = cv.minAreaRect(contour);
      const center = rect.center;
  
      let topLeftPoint;
      let topLeftDistance = 0;
  
      let topRightPoint;
      let topRightDistance = 0;
  
      let bottomLeftPoint;
      let bottomLeftDistance = 0;
  
      let bottomRightPoint;
      let bottomRightDistance = 0;
  
      for (let i = 0; i < contour.data32S.length; i += 2) {
        const point = { x: contour.data32S[i], y: contour.data32S[i + 1] };
        const distance = this.distance(point, center);
        if (point.x < center.x && point.y < center.y) {
          if (distance > topLeftDistance) {
            topLeftPoint = point;
            topLeftDistance = distance;
          }
        } else if (point.x > center.x && point.y < center.y) {
          if (distance > topRightDistance) {
            topRightPoint = point;
            topRightDistance = distance;
          }
        } else if (point.x < center.x && point.y > center.y) {
          if (distance > bottomLeftDistance) {
            bottomLeftPoint = point;
            bottomLeftDistance = distance;
          }
        } else if (point.x > center.x && point.y > center.y) {
          if (distance > bottomRightDistance) {
            bottomRightPoint = point;
            bottomRightDistance = distance;
          }
        }
      }
      points.push(topLeftPoint);
      points.push(topRightPoint);
      points.push(bottomRightPoint);
      points.push(bottomLeftPoint);
      return points;
    }
  }