const router = require("express").Router();
const filesController = require("../controllers/files.controller.js");

router.post("/upload", filesController.upload);
router.post("/add-files", filesController.add);
router.post("/my-files", filesController.getFiles);
router.post("/remove-files", filesController.removeFiles);
router.get("/get-main-videos", filesController.getVideos);
router.post("/post-data-video", filesController.postDataVideo);
router.post("/request-new", filesController.requestNewMovieOrSerie);
router.get("/request-queue", filesController.getRequestQueue);
router.get("/update-list", filesController.updateList);

module.exports = router;
