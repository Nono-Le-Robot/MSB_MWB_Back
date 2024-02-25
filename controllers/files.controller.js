const fs = require("fs");
const md5 = require("md5");
const userModel = require("../models/auth.model");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const fetch = require('node-fetch-commonjs');

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
          const userId = decodedToken.data._id;
          const { name, currentChunkIndex, totalChunks } = req.query;
          const originalName = name.split(".")[0];
          const firstChunk = parseInt(currentChunkIndex) === 0;
          const lastChunk =
            parseInt(currentChunkIndex) === parseInt(totalChunks) - 1;
          const ext = name.split(".").pop();
          const data = req.body.toString().split(",")[1];
          const buffer = new Buffer.from(data, "base64");
          const dateToString = Date.now().toString();
          const tmpFilename =
            "tmp_" +
            dateToString.substr(0, 4) +
            originalName.replace(" ", "_") +
            "." +
            ext;
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
              const finalFilename =
                Date.now() + "_" + originalName.replace(" ", "_") + "." + ext;
              fs.renameSync(
                `./files/${userId}/` + tmpFilename,
                `./files/${userId}/` + finalFilename
              );

              if (
                ext === "png" ||
                ext === "jpg" ||
                ext === "jpeg" ||
                ext === "gif"
              ) {
                fs.access(`files/${userId}/prev`, function (notFound) {
                  if (notFound) {
                    fs.mkdirSync(`files/${userId}/prev`);
                  }
                });

                let outputPrevImage = `./files/${userId}/prev/${finalFilename}`;
                sharp(`./files/${userId}/${finalFilename}`)
                  .resize({ height: 600, width: 800 })
                  .toFile(outputPrevImage)
                  .then(function (newFileInfo) {
                    res.json({ finalFilename });
                  })
                  .catch((err) => console.log(err));
              } else {
                res.json({ finalFilename });
              }
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
          const userId = decodedToken.data._id;
          const {isVideo, isMovie, isSerie, season, episode, formatedName} = req.body
          const options = {
            method: 'GET',
            headers: {
              accept: 'application/json',
              Authorization: `Bearer ${process.env.TMDB_SECRET}`
            }
        };
        const getSerieInfo = async (serieSearch, seasonNumber) => {
            try {
                const response = await fetch(`https://api.themoviedb.org/3/search/tv?query=${serieSearch}&include_adult=true&language=fr-FR&page=1`, options);
                const data = await response.json();
                const serieId = data.results[0].id;
                const serieName = data.results[0].name;
                const imageResponse = await fetch(`https://api.themoviedb.org/3/tv/${serieId}/images`, options);
                const imageData = await imageResponse.json();
                const serieImage = `https://image.tmdb.org/t/p/w500/${imageData.posters[0].file_path}`;
                const seasonResponse = await fetch(`https://api.themoviedb.org/3/tv/${serieId}/season/${Number(seasonNumber)}?language=fr-FR`, options);
                const seasonData = await seasonResponse.json();
                const episodesData = seasonData.episodes.map(episode => ({
                    serieName: serieName,
                    image:serieImage,
                    seasonNumber: seasonData.episodes[0].season_number,
                    episodeNumber: episode.episode_number,
                    episodeName: episode.name,
                    episodeDescription: episode.overview,
                }));
                return episodesData;
            } catch (err) {
                console.error(err);
                return [];
            }
        };
        
        const getMovieInfo = async (movieSearch) => {
            try {
                const response = await fetch(`https://api.themoviedb.org/3/search/movie?query=${movieSearch}&include_adult=true&language=fr-FR&page=1`, options);
                const data = await response.json();
                console.log('resultat', data.results.length);
                if(data.results.length > 0){
                  const movieId = data.results[0].id;
                  const movieName = data.results[0].original_title
                  const movieDescription = data.results[0].overview
                  const imageResponse = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/images`, options);
                  const imageData = await imageResponse.json();
                  const movieImage = `https://image.tmdb.org/t/p/w500/${imageData.posters[0].file_path}`;
                  const movieData = {
                    movieName : movieName,
                    movieDescription : movieDescription,
                    image : movieImage
                  }
                  return [movieData];
                }
                else{
                  return null
                }



            } catch (err) {
                console.error(err);
                return [];
            }
        };
        let conditionalDataSerie = {}
        let conditionalDataMovie = {}
        if(isSerie){
          const TMDB = await getSerieInfo(formatedName, season)
          const episodeData = TMDB.filter(p => p.episodeNumber === Number(episode))
          conditionalDataSerie = {
            isSerie: isSerie,
            isMovie: isMovie,
            season: season,
            episode: episode,
            serieName : episodeData[0].serieName,
            episodeNameTMDB : episodeData[0].episodeName,
            descriptionTMDB : episodeData[0].episodeDescription,
            ImageTMDB : episodeData[0].image
          };
        }
        else if(isMovie){
          const TMDB = await getMovieInfo(formatedName)
          let phraseCapitalisee = formatedName.replace(/-/g, ' ');
          const mots = phraseCapitalisee.split(" ");
          const motsCapitalises = mots.map(mot => mot.charAt(0).toUpperCase() + mot.slice(1).toLowerCase());
          const formatedMovieName = motsCapitalises.join(" ");
          if(TMDB){
            conditionalDataMovie = {
              isSerie: isSerie,
              isMovie: isMovie,
              movieName : formatedName,
              descriptionTMDB : TMDB[0].movieDescription,
              ImageTMDB : TMDB[0].image,
              formatedMovieName : formatedMovieName
            };
          }
        }
        userModel
        .findByIdAndUpdate(
          { _id: userId },
          {
            $addToSet: {
              files: {
                username: req.body.username,
                name: req.body.filename,
                formatedName : formatedName,
                link: req.body.link,
                prev: req.body.prev,
                size: req.body.size,
                format: req.body.format,
                watchedBy : [], 
                likedBy : [], 
                ...conditionalDataSerie,
                ...conditionalDataMovie
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
          const userId = decodedToken.data._id;
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

module.exports.getVideos = (req,res) => {
  const userId = `${process.env.MAIN_USER_MWB}`;
          userModel
            .findById({ _id: userId })
            .select("-password")
            .then((findFiles) => {
              res.status(200).json({ files: findFiles.files });
            })
            .catch((err) => res.status(400).json({ err: err }));
}

module.exports.removeFiles = (req, res) => {
  const token = req.body.iat;
  jwt.verify(
    token,
    `${process.env.ACCESS_TOKEN_SECRET}`,
    (err, decodedToken) => {
      if (err) {
        console.log(err);
      } else {
        const userId = decodedToken.data._id;
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
