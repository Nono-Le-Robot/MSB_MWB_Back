const router = require("express").Router();
const filesController = require("../controllers/files.controller.js");

router.post("/upload", filesController.upload);
router.post("/add-files", filesController.add);
router.post("/my-files", filesController.getFiles);
router.post("/remove-files", filesController.removeFiles);
router.get('/get-main-videos', filesController.getVideos);

module.exports = router;
