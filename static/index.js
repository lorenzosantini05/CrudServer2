$(document).ready(function () {

	let txtUser = $("#txtUser");
	let txtFile = $("#txtFile");

	getImages();

	function getImages() {
		let rq = inviaRichiesta("GET", "/api/getImages");
		rq.catch(errore);
		rq.then((response) => {
			let tbody = $("#mainTable").children("tbody");
			tbody.empty();
			for (let image of response.data) {
				let tr = $("<tr>").appendTo(tbody).addClass("text-center");
				$("<td>").appendTo(tr).text(image.username);
				// Se esiste e non è un base64 e non è cloudinary
				if (image.img && !image.img.toString().startsWith("data:image") && !image.img.toString().startsWith("https://res.cloudinary.com")) {
					image.img = `img/${image.img}`;
				}
				$("<td>").appendTo(tr).append($("<img>").prop("src", image.img));
			}
		});
	}

	$("#btnBinary").on("click", () => {
		let username = $("#txtUser").val();
		// La proprietà files restituisce sempre un vettore di File Objects
		let img = $("#txtFile").prop("files")[0];
		if (!username || !img) {
			alert("Inserire username e immagine");
		}
		else {
			let formData = new FormData();
			formData.append("username", username);
			formData.append("img", img);
			// Il formData va passatto così com'è, non bisogna creare un json
			let rq = inviaRichiesta("POST", "/api/addBinaryImage", formData);
			rq.catch(errore);
			rq.then((response) => {
				alert("Record inserito correttamente");
				getImages();
				$("#txtUser").val("");
				$("#txtFile").val("");
			});
		}
	});

	$("#btnBase64").on("click", async function () {
		let username = $("#txtUser").val();
		// La proprietà files restituisce sempre un vettore di File Objects
		let img = $("#txtFile").prop("files")[0];
		if (!username || !img) {
			alert("Inserire username e immagine");
		}
		else {
			// Senza await restituisce una promise e i dati saranno dentro la callback del then
			// let promise = base64Convert(img);
			// promise.catch((err) => alert(`Errore conversione file: ${err}`));
			// promise.then((imgBase64) => console.log(imgBase64));
			// Con await restituisce direttamente i dati e non la promise. Per prendere l'errore si accoda il .catch() con la sua callback
			let imgBase64 = await base64Convert(img).catch((err) => alert(`Errore conversione file: ${err}`));
			console.log(imgBase64);
			let rq = inviaRichiesta("POST", "/api/addBase64Image", { username, imgBase64 });
			rq.catch(errore);
			rq.then((response) => {
				alert("Record inserito correttamente");
				getImages();
				$("#txtUser").val("");
				$("#txtFile").val("");
			});
		}
	});

	$("#btnBase64Cloudinary").on("click", () => {

	});

});

// Il parametro img è di tipo File Object e restituisce un base64
function base64Convert(fileObject) {
	return new Promise((resolve, reject) => {
		let reader = new FileReader();
		reader.readAsDataURL(fileObject);
		// event viene passato a tutte le procedure Javascript e contiene 
		// un parametro chiamato target che rappresenta il puntatore all'elemento 
		// che ha scatenato l'evento
		reader.onload = (event) => {
			// resolve(reader.result);
			resolve(event.target.result);
		}
		reader.onerror = (err) => {
			reject(err);
		}
	});
}

/* *********************** resizeAndConvert() ****************************** */
/* resize (tramite utilizzo della libreria PICA.JS) and base64 conversion    */
// Il parametro file è di tipo File Object
function resizeAndConvert(file) {
	/* step 1: lettura tramite FileReader del file binario scelto dall'utente.
			   File reader restituisce un file base64
	// step 2: conversione del file base64 in oggetto Image da passare alla lib pica
	// step 3: resize mediante la libreria pica che restituisce un canvas
				che trasformiamo in blob (dato binario di grandi dimensioni)
	// step 4: conversione del blob in base64 da inviare al server               */
	return new Promise(function (resolve, reject) {
		const WIDTH = 640;
		const HEIGHT = 480;
		let type = file.type;
		let reader = new FileReader();
		reader.readAsDataURL(file) // restituisce il file in base 64
		//reader.addEventListener("load", function () {
		reader.onload = function () {
			let img = new Image()
			img.src = reader.result // reader.result restituisce l'immagine in base64  						
			img.onload = function () {
				if (img.width < WIDTH && img.height < HEIGHT)
					resolve(reader.result);
				else {
					let canvas = document.createElement("canvas");
					if (img.width > img.height) {
						canvas.width = WIDTH;
						canvas.height = img.height * (WIDTH / img.width)
					} else {
						canvas.height = HEIGHT
						canvas.width = img.width * (HEIGHT / img.height);
					}
					let _pica = new pica()
					_pica.resize(img, canvas, {
						unsharpAmount: 80,
						unsharpRadius: 0.6,
						unsharpThreshold: 2
					})
						.then(function (resizedImage) {
							// resizedImage è restituita in forma di canvas
							_pica.toBlob(resizedImage, type, 0.90)
								.then(function (blob) {
									var reader = new FileReader();
									reader.readAsDataURL(blob);
									reader.onload = function () {
										resolve(reader.result); //base 64
									}
								})
								.catch(err => reject(err))
						})
						.catch(function (err) { reject(err) })
				}
			}
		}
	})
}