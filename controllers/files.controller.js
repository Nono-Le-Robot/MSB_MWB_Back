const fs = require("fs");
const md5 = require("md5");
const userModel = require("../models/auth.model");
const requestModel = require("../models/request.model");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const fetch = require("node-fetch-commonjs");
const movieModel = require("../models/movie.model");

module.exports.upload = async (req, res) => {
  const token = req.query.uploadBy;
  if (token) {
    jwt.verify(
      token,
      `${process.env.ACCESS_TOKEN_SECRET}`,
      (err, decodedToken) => {
        if (err) {
          console.log("err");
        } else {
          const userId = decodedToken.data.userId;
          const { uuid, name, currentChunkIndex, totalChunks } = req.query; // ok
          const firstChunk = parseInt(currentChunkIndex) === 0;
          const lastChunk =
            parseInt(currentChunkIndex) === parseInt(totalChunks) - 1;
          const data = req.body.toString().split(",")[1];
          const buffer = new Buffer.from(data, "base64");
          const tmpFilename = "tmp_" + uuid + "_" + name;
          fs.access(`files/${userId}`, function (notFound) {
            if (notFound) {
              fs.mkdirSync(`files/${userId}`);
            }
          });
          setTimeout(() => {
            if (
              firstChunk &&
              fs.existsSync(`./files/${userId}/` + tmpFilename)
            ) {
              fs.unlinkSync(`./files/${userId}/` + tmpFilename);
            }
            fs.appendFileSync(`./files/${userId}/` + tmpFilename, buffer);
            if (lastChunk) {
              const finalFilename = Date.now() + "_" + name;
              fs.renameSync(
                `./files/${userId}/` + tmpFilename,
                `./files/${userId}/` + finalFilename
              );
              res.json({ finalFilename });
            } else {
              res.json("ok");
            }
          }, 200);
        }
      }
    );
  } else {
    res.status(404).send("no token");
  }
};

module.exports.add = async (req, res) => {
  const token = req.body.token;
  if (token) {
    jwt.verify(
      token,
      `${process.env.ACCESS_TOKEN_SECRET}`,
      async (err, decodedToken) => {
        if (err) {
          console.log("err");
        } else {
          const userId = decodedToken.data.userId;
          const {
            displayName,
            isVideo,
            isMovie,
            isSerie,
            season,
            episode,
            formatedName,
          } = req.body;
          const options = {
            method: "GET",
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${process.env.TMDB_SECRET}`,
            },
          };
          const getSerieInfo = async (serieSearch, seasonNumber) => {
            try {
              const response = await fetch(
                `https://api.themoviedb.org/3/search/tv?query=${serieSearch}&include_adult=true&language=fr-FR&page=1`,
                options
              );
              const data = await response.json();
              console.log(data.results);
              if (data.results.length > 0) {
                const serieId = data.results[0].id;
                const serieName = data.results[0].name;
                const imageResponse = await fetch(
                  `https://api.themoviedb.org/3/tv/${serieId}/images`,
                  options
                );
                const imageData = await imageResponse.json();
                const serieImage = `https://image.tmdb.org/t/p/w500/${imageData.posters[0].file_path}`;
                const seasonResponse = await fetch(
                  `https://api.themoviedb.org/3/tv/${serieId}/season/${Number(
                    seasonNumber
                  )}?language=fr-FR`,
                  options
                );
                const seasonData = await seasonResponse.json();
                const episodesData = seasonData.episodes.map((episode) => ({
                  displayName: serieName,
                  image: serieImage,
                  seasonNumber: seasonData.episodes[0].season_number,
                  episodeNumber: episode.episode_number,
                  episodeName: episode.name,
                  episodeDescription: episode.overview,
                }));
                return episodesData;
              } else {
                return null;
              }
            } catch (err) {
              console.error(err);
              return [];
            }
          };

          const getMovieInfo = async (movieSearch) => {
            try {
              const response = await fetch(
                `https://api.themoviedb.org/3/search/movie?query=${movieSearch}&include_adult=true&language=fr-FR&page=1`,
                options
              );
              const data = await response.json();
              if (data.results.length > 0) {
                const movieId = data.results[0].id;
                const movieName = data.results[0].original_title;
                const movieDescription = data.results[0].overview;
                const imageResponse = await fetch(
                  `https://api.themoviedb.org/3/movie/${movieId}/images`,
                  options
                );
                const imageData = await imageResponse.json();
                const movieImage = `https://image.tmdb.org/t/p/w500/${imageData.posters[0].file_path}`;
                const movieData = {
                  displayName: movieName,
                  movieDescription: movieDescription,
                  image: movieImage,
                };
                return [movieData];
              } else {
                return null;
              }
            } catch (err) {
              console.error(err);
              return [];
            }
          };
          let conditionalDataSerie = {};
          let conditionalDataMovie = {};
          let defaultName = formatedName;
          const words = defaultName.split(" ");
          for (let i = 0; i < words.length; i++) {
            words[i] = words[i][0].toUpperCase() + words[i].substring(1);
          }

          defaultName = words.join(" ");

          if (isSerie) {
            const TMDB = await getSerieInfo(formatedName, season);
            console.log(formatedName);
            if (TMDB) {
              const episodeData = TMDB.filter(
                (p) => p.episodeNumber === Number(episode)
              );
              conditionalDataSerie = {
                isSerie: isSerie,
                isMovie: isMovie,
                season: season,
                episode: episode,
                displayName: episodeData[0].displayName,
                episodeNameTMDB: episodeData[0].episodeName,
                descriptionTMDB: episodeData[0].episodeDescription,
                ImageTMDB: episodeData[0].image,
              };
            }
          } else if (isMovie) {
            const TMDB = await getMovieInfo(formatedName);
            if (TMDB) {
              conditionalDataMovie = {
                displayName: TMDB[0].displayName,
                isSerie: isSerie,
                isMovie: isMovie,
                descriptionTMDB: TMDB[0].movieDescription,
                ImageTMDB: TMDB[0].image,
              };
            }
          }
          userModel
            .findByIdAndUpdate(
              { _id: userId },
              {
                $addToSet: {
                  files: {
                    uploadBy: req.body.email,
                    name: req.body.filename,
                    formatedName: formatedName,
                    displayName: defaultName.replace(/-/g, " "),
                    link: req.body.link,
                    prev: req.body.prev,
                    size: req.body.size,
                    format: req.body.format,
                    watchedBy: [],
                    likedBy: [],
                    ...conditionalDataSerie,
                    ...conditionalDataMovie,
                  },
                },
              }
            )
            .select("-password")
            .then((updatedPost) => {
              res.json({ msg: "upload in DB OK" });
            })
            .catch((err) => res.json({ err: err }));
        }
      }
    );
  } else {
    res.status(404).send("no token");
  }
};

module.exports.postDataVideo = async (req, res) => {
  const token = req.body.token;
  const watched = req.body.watched;
  const videoName = req.body.videoName;

  if (token) {
    jwt.verify(
      token,
      `${process.env.ACCESS_TOKEN_SECRET}`,
      async (err, decodedToken) => {
        if (err) {
          console.log("err");
          return res.status(401).send("Unauthorized");
        } else {
          const userId = decodedToken.data.userId;
          let mainUsers = JSON.parse(process.env.MAIN_USER_MWB);

          try {
            await Promise.all(
              mainUsers.map(async (user) => {
                const video = await userModel.findOne({
                  _id: user,
                  "files.name": videoName,
                });

                if (video) {
                  video.files.forEach((file) => {
                    if (file.name === videoName) {
                      if (watched) {
                        file.watchedBy.push(userId);
                      } else {
                        file.watchedBy = file.watchedBy.filter(
                          (id) => id !== userId
                        );
                      }
                    }
                  });

                  await userModel.findByIdAndUpdate({ _id: user }, video, {
                    new: true,
                  });
                }
              })
            );

            res.json({
              message: "Video watched successfully",
            });
          } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
          }
        }
      }
    );
  } else {
    res.status(404).send("no token");
  }
};

module.exports.getFiles = (req, res) => {
  const token = req.body.token;
  if (token) {
    jwt.verify(
      token,
      `${process.env.ACCESS_TOKEN_SECRET}`,
      (err, decodedToken) => {
        if (err) {
          console.log(err);
        } else {
          const userId = decodedToken.data.userId;
          userModel
            .findById({ _id: userId })
            .select("-password")
            .then((findFiles) => {
              res.status(200).json({ files: findFiles.files });
            })
            .catch((err) => res.status(400).json({ err: err }));
        }
      }
    );
  } else {
    res.status(404).send("no token");
  }
};

module.exports.getVideos = async (req, res) => {
  let mainUsers = JSON.parse(process.env.MAIN_USER_MWB);

  try {
    let promises = mainUsers.map((user) =>
      userModel
        .findById({ _id: user })
        .select("-password")
        .then((findFiles) => findFiles.files)
    );
    let combinedData = (await Promise.all(promises)).flat();
    res.status(200).json({ files: combinedData });
  } catch (err) {
    res.status(400).json({ err: err });
  }
};

module.exports.removeFiles = (req, res) => {
  const token = req.body.iat;
  jwt.verify(
    token,
    `${process.env.ACCESS_TOKEN_SECRET}`,
    (err, decodedToken) => {
      if (err) {
        console.log(err);
      } else {
        const userId = decodedToken.data.userId;
        userModel
          .findByIdAndUpdate(
            { _id: userId },
            {
              $pull: {
                files: {
                  name: req.body.fileName,
                },
              },
            }
          )
          .select("-password")
          .then((updatedPost) => {
            fs.unlink(`./files/${userId}/${req.body.fileName}`, () => {
              if (
                req.body.fileName.substr(-3) === "png" ||
                req.body.fileName.substr(-3) === "jpg" ||
                req.body.fileName.substr(-4) === "jpeg" ||
                req.body.fileName.substr(-3) === "gif"
              ) {
                fs.unlink(`./files/${userId}/prev/${req.body.fileName}`, () => {
                  res.json({ msg: "upload in DB OK" });
                });
              } else {
                res.json({ msg: "upload in DB OK" });
              }
            });
          })
          .catch((err) => res.json({ err: err }));
      }
    }
  );
};

module.exports.requestNewMovieOrSerie = async (req, res) => {
  const { name, year, info, token } = req.body;
  let user = null;
  jwt.verify(
    token,
    `${process.env.ACCESS_TOKEN_SECRET}`,
    (err, decodedToken) => {
      if (err) {
        console.log(err);
        res.status(404).json("user not found");
      } else {
        user = decodedToken.data;
      }
    }
  );
  const newRequest = await new requestModel({
    name: name,
    year: year,
    info: info,
    requestedBy: `${user.username} / ${user.email}`,
  });

  newRequest
    .save()
    .then(() => {
      res.status(200).json({ msg: "request created", name: name });
    })
    .catch((err) => res.status(400).json({ error: err.message }));
};

module.exports.getRequestQueue = async (req, res) => {
  try {
    await requestModel.find({}).then((requests) => {
      res.status(200).json(requests.filter((p) => p.name !== "MovieName"));
    });
  } catch (err) {
    res.status(400).json({ err: err });
  }
};

module.exports.updateList = async (req, res) => {
  let mainUsers = JSON.parse(process.env.MAIN_USER_MWB);
  try {
    await movieModel.deleteMany({});
    let promises = mainUsers.map((user) =>
      userModel
        .findById({ _id: user })
        .select("-password")
        .then((findFiles) => findFiles.files)
    );
    let combinedData = (await Promise.all(promises)).flat();

    // res.status(200).json(combinedData);

    combinedData.forEach(async (video) => {
      const fixedWatchedBy = [...new Set(video.watchedBy)];
      if (video.isSerie) {
        const newRequest = await new movieModel({
          name: video.displayName,
          imageTMDB: video.ImageTMDB,
          season: video.season,
          episode: video.episode,
          episodeName: video.episodeNameTMDB,
          description: video.descriptionTMDB,
          link: video.link,
          views: fixedWatchedBy.length,
          isSerie: true,
          isMovie: false,
          size: video.size,
          watchedBy: fixedWatchedBy,
          likedBy: video.likedBy,
        });
        newRequest
          .save()
          .then(() => {})
          .catch((err) => res.status(400).json({ error: err.message }));
      } else {
        const newRequest = await new movieModel({
          name: video.displayName,
          imageTMDB: video.ImageTMDB,
          description: video.descriptionTMDB,
          link: video.link,
          views: fixedWatchedBy.length,
          isSerie: false,
          isMovie: true,
          size: video.size,
          watchedBy: fixedWatchedBy,
          likedBy: video.likedBy,
        });

        newRequest
          .save()
          .then(() => {})
          .catch((err) => res.status(400).json({ error: err.message }));
      }
    });
    res.status(200).json("updated");
  } catch (err) {
    res.status(400).json({ err: err });
  }
};

module.exports.changeName = async (req, res) => {
  const { prevName, newName, newImage } = req.body;
  console.log(prevName, newName, newImage);
  let mainUsers = JSON.parse(process.env.MAIN_USER_MWB);

  try {
    // Utilisez Promise.all pour attendre que toutes les promesses soient résolues
    await Promise.all(
      mainUsers.map(async (user) => {
        const userDoc = await userModel.findById(user).select("-password");

        const filesToUpdate = userDoc.files.filter(
          (file) => file.displayName === prevName
        );
        filesToUpdate.forEach((file) => {
          if (newName !== "") file.displayName = newName;
          if (newImage !== "") file.ImageTMDB = newImage;
        });
        userDoc.markModified("files");
        await userDoc.save();
      })
    );

    res.json({ msg: "Noms mis à jour avec succès" });
  } catch (err) {
    res.status(400).json({ err: err });
  }
};
