const fs = require("fs");
const md5 = require("md5");
const userModel = require("../models/auth.model");
const requestModel = require("../models/request.model");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const fetch = require("node-fetch-commonjs");

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
  const videoName = req.body.videoName; // Assurez-vous que le nom de la vidéo est envoyé dans la requête

  if (token) {
    jwt.verify(
      token,
      `${process.env.ACCESS_TOKEN_SECRET}`,
      async (err, decodedToken) => {
        if (err) {
          res.status("400", err);
        } else {
          const userId = decodedToken.data.userId;
          let mainUsers = JSON.parse(process.env.MAIN_USER_MWB);

          // Trouver la vidéo par le nom
          const video = await userModel.findOne({
            _id: mainUsers[0],
            "files.name": videoName, // Utilisez le nom de la vidéo pour la recherche
          });

          if (video) {
            // Ajouter l'ID de l'utilisateur à watchedBy de la vidéo
            video.files.forEach((file) => {
              if (file.name === videoName) {
                if (watched) {
                  file.watchedBy.push(userId);
                } else {
                  file.watchedBy = file.watchedBy.filter((id) => id !== userId);
                }
              }
            });

            // Mettre à jour la vidéo avec la nouvelle information
            const updatedVideo = await userModel.findByIdAndUpdate(
              { _id: mainUsers[0] },
              video,
              { new: true }
            );

            // Gérer la réponse
            if (updatedVideo) {
              res.json({
                message: "Video watched successfully",
                video: updatedVideo,
              });
            } else {
              res.status(404).send("Video not found 1");
            }
          } else {
            res.status(404).send("Video not found 2");
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
  const { name, year, info } = req.body;
  console.log(req.body);
  const newRequest = await new requestModel({
    name: name,
    year: year,
    info: info,
  });

  newRequest
    .save()
    .then(() => {
      res.status(200).json({ msg: "request created", name: name });
    })
    .catch((err) => res.status(400).json({ error: err.message }));
};
