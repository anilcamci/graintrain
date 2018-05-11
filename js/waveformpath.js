var WaveformPath = function(points) {

	this.type = 'WaveformPath';

	this.splinePoints = points;
	this.pointObjects;
	this.spline;

	var geometry, material;

	this.cursor = new THREE.Mesh(
		new THREE.SphereGeometry(5),
		new THREE.MeshBasicMaterial({ color:0x00ccff })
	);
	this.cursor.visible = false;

	this.renderPath = function() {

		var points = this.splinePoints;

		this.spline = new THREE.CatmullRomCurve3(this.splinePoints);
		this.spline.type = 'centripetal';

		var begEndDistance = this.splinePoints[0].distanceTo(this.splinePoints[this.splinePoints.length - 1]);

		if(begEndDistance < 20) this.spline.closed = true;
		else this.spline.closed = false;

		geometry = new THREE.Geometry();
		geometry.vertices = this.spline.getPoints(200);
		material = new THREE.LineBasicMaterial({
			color: 0x00ccff,
			linewidth:1,
			opacity:1
		});
		this.spline.mesh = new THREE.Line( geometry, material );
	}
	this.renderPath();
}


WaveformPath.prototype = {

	constructor: WaveformPath,

	get objects() {
		return this.spline.mesh;
	},

	removeFromScene: function(scene) {
		this.objects.forEach(function(obj) {
			scene.remove(obj, true);
		});
		scene.remove(this.cursor);
	},

	addPoint: function(position) {

		var closestSplinePoint = 0;
		var prevDistToSplinePoint = -1;
		var minDistance = Number.MAX_VALUE;
		var minPoint = 1;

		for (var t=0; t < 1; t+=1/200.0) {
			var pt = this.spline.getPoint(t);

			var distToSplinePoint = this.splinePoints[closestSplinePoint].distanceToSquared(pt);
			if (distToSplinePoint > prevDistToSplinePoint) {
				++closestSplinePoint;
				if (closestSplinePoint >= this.splinePoints.length)
					closestSplinePoint = 0;
			}
			prevDistToSplinePoint = this.splinePoints[closestSplinePoint].distanceToSquared(pt);
			var distToPoint = pt.distanceToSquared(position);
			if (distToPoint < minDistance) {
				minDistance = distToPoint;
				minPoint = closestSplinePoint;
			}
		}

		this.splinePoints.splice(minPoint, 0, position);
		this.updatePath();
		this.selectPoint(this.pointObjects[minPoint]);

	},

	updatePath: function() {
		var scene = this.spline.mesh.parent;
		this.removeFromScene(scene);
		this.renderPath();
	}
}


waveformPath = {
	scene: null,
	points: [],
	lines: [],
	lastPoint: new THREE.Vector3(),

	setScene: function(scene) {
		this.scene = scene;
	},

	beginAt: function(point, scene) {
		this.lastPoint = point;
		this.points = [point];
	},

	addPoint: function(point) {
		if (this.scene === null) {
			console.log('scene not set');
			return;
		}

		var material = new THREE.LineBasicMaterial({
			color: 0x00ccff
		});
		var geometry = new THREE.Geometry();
		geometry.vertices.push(this.lastPoint, point);
		var line = new THREE.Line(geometry,material);

		this.lastPoint = point;
		this.points.push(point);
		this.lines.push(line);
		this.scene.add(line);
	},

	createObject: function() {
		var points = simplify(this.points, 10, true);
		var object;

		object = new WaveformPath(points);

		this.clear();

		return object;
	},

	clear: function() {
		var scene = this.scene;
		this.lines.forEach(function(line) {
			scene.remove(line);
		});
		this.lines = [];
		this.points = [];
	}
}
