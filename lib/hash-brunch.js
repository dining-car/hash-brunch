// Generated by CoffeeScript 1.9.3
(function() {
  var HASHEDFILE_PATTERN, HashBrunch, PRECISION, crypto, debug, fs, glob, imagesize, path, warn,
    indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  crypto = require('crypto');

  fs = require('fs');

  path = require('path');

  glob = require('glob');

  imagesize = require('image-size');

  PRECISION = 8;

  HASHEDFILE_PATTERN = /^(.+)-([0-9a-f]{6,})(\..*)$/;

  warn = function(message) {
    return console.log("hash-brunch WARNING: " + message);
  };

  debug = function(message) {};

  module.exports = HashBrunch = (function() {
    HashBrunch.prototype.brunchPlugin = true;

    function HashBrunch(config) {
      var cfg, k, ref, ref1;
      this.config = config;
      this.options = {
        precision: 8,
        assetFolder: "app/assets",
        environments: ["production"],
        alwaysRun: false
      };
      cfg = (ref = (ref1 = this.config.plugins) != null ? ref1.hashbrunch : void 0) != null ? ref : {};
      for (k in cfg) {
        this.options[k] = cfg[k];
      }
    }

    HashBrunch.prototype._stripHash = function(url) {
      if (path.basename(url).match(HASHEDFILE_PATTERN)) {
        url = url.replace(HASHEDFILE_PATTERN, "$1$3");
      }
      return url;
    };

    HashBrunch.prototype._isHashed = function(url) {
      return path.basename(url).match(HASHEDFILE_PATTERN);
    };

    HashBrunch.prototype._isType = function(url, endings) {
      return url.search("^.+\.(" + endings + ")$") !== -1;
    };

    HashBrunch.prototype._calculateHash = function(file, digest) {
      var data, shasum;
      data = fs.readFileSync(file);
      shasum = crypto.createHash('sha1');
      shasum.update(data);
      return shasum.digest('hex').slice(0, +(this.options.precision - 1) + 1 || 9e9);
    };

    HashBrunch.prototype._shouldRun = function() {
      var ref;
      return (ref = this.config.env[0], indexOf.call(this.options.environments, ref) >= 0) || this.options.alwaysRun;
    };

    HashBrunch.prototype.onCompile = function(generatedFiles) {
      var digest, error, file, hash, i, imgSize, j, l, len, len1, len2, len3, m, manifestPath, newUrl, ref, ref1, url, urlInfo, urlWithoutHash, urlsInAssets, urlsInPublic;
      if (!this._shouldRun()) {
        return;
      }
      this.publicFolder = this.config.paths["public"];
      urlsInPublic = glob.sync('**', {
        cwd: this.publicFolder
      });
      urlsInAssets = glob.sync('**', {
        cwd: this.options.assetFolder
      });
      for (i = 0, len = urlsInPublic.length; i < len; i++) {
        url = urlsInPublic[i];
        file = path.join(this.publicFolder, url);
        if (!fs.lstatSync(file).isFile()) {
          continue;
        }
        if ((!this._isType(url, "css|map|js")) && !(ref = this._stripHash(url), indexOf.call(urlsInAssets, ref) >= 0)) {
          debug("deleting " + file + ": assetRemoved");
          fs.unlinkSync(file);
          continue;
        }
        if (this._isHashed(url) && (ref1 = this._stripHash(url), indexOf.call(urlsInPublic, ref1) >= 0)) {
          debug("deleting " + file + ": newVersion");
          fs.unlinkSync(file);
          continue;
        }
      }
      urlsInPublic = glob.sync('**', {
        cwd: this.publicFolder
      });
      for (j = 0, len1 = urlsInPublic.length; j < len1; j++) {
        url = urlsInPublic[j];
        file = path.join(this.publicFolder, url);
        if (!fs.lstatSync(file).isFile()) {
          continue;
        }
        if (this._isType(url, "js|css")) {
          continue;
        }
        if (this._isHashed(url)) {
          continue;
        }
        hash = this._calculateHash(file);
        urlInfo = path.parse(url);
        newUrl = path.join(urlInfo.dir, urlInfo.name + '-' + hash + urlInfo.ext);
        debug("rename " + url + " -> " + newUrl);
        fs.renameSync(path.join(this.publicFolder, url), path.join(this.publicFolder, newUrl));
      }
      digest = {};
      urlsInPublic = glob.sync('**', {
        cwd: this.publicFolder
      });
      for (l = 0, len2 = urlsInPublic.length; l < len2; l++) {
        url = urlsInPublic[l];
        file = path.join(this.publicFolder, url);
        if (!fs.lstatSync(file).isFile()) {
          continue;
        }
        if (this._isType(url, "js|css")) {
          continue;
        }
        if (!this._isHashed(file)) {
          throw file + " is not hashed!";
        }
        digest[this._stripHash(url)] = {
          url: url
        };
        try {
          imgSize = imagesize(file);
          digest[this._stripHash(url)].imgSize = [imgSize.width, imgSize.height];
        } catch (_error) {
          error = _error;
        }
      }
      this._fixUrls(digest);
      urlsInPublic = glob.sync('**', {
        cwd: this.publicFolder
      });
      for (m = 0, len3 = urlsInPublic.length; m < len3; m++) {
        url = urlsInPublic[m];
        file = path.join(this.publicFolder, url);
        if (!fs.lstatSync(file).isFile()) {
          continue;
        }
        if (!this._isType(url, "css|js")) {
          continue;
        }
        hash = this._calculateHash(file);
        urlWithoutHash = this._stripHash(url);
        urlInfo = path.parse(urlWithoutHash);
        newUrl = path.join(urlInfo.dir, urlInfo.name + '-' + hash + urlInfo.ext);
        debug("rename " + url + " -> " + newUrl);
        fs.renameSync(path.join(this.publicFolder, url), path.join(this.publicFolder, newUrl));
        digest[urlWithoutHash] = {
          url: newUrl
        };
      }
      manifestPath = path.join(this.publicFolder, "manifest.json");
      return fs.writeFileSync(manifestPath, JSON.stringify(digest, null, 4));
    };

    HashBrunch.prototype._fixUrls = function(digest) {
      var content, file, i, len, replaceCSSURL, replaceSourceMapURLs, results, url, urlsInPublic;
      replaceCSSURL = function(match, url, suffix) {
        var newUrl;
        if (url.match(HASHEDFILE_PATTERN)) {
          url = url.replace(HASHEDFILE_PATTERN, "$1$3");
        }
        if (digest[url] !== void 0) {
          newUrl = digest[url].url + suffix;
          debug("css: url-rewrite " + url + " -> " + newUrl);
          url = newUrl;
        } else {
          url = url + suffix;
        }
        return "url(" + url + ")";
      };
      replaceSourceMapURLs = function(match, capture) {
        var newUrl, url;
        url = capture + ".map";
        if (url.match(HASHEDFILE_PATTERN)) {
          url = url.replace(HASHEDFILE_PATTERN, "$1$3");
        }
        if (digest[url] !== void 0) {
          newUrl = digest[url].url;
          debug("sourceMap rewrite " + url + " -> " + newUrl);
          url = newUrl;
        }
        return "# sourceMappingURL=" + url;
      };
      urlsInPublic = glob.sync('**', {
        cwd: this.publicFolder
      });
      results = [];
      for (i = 0, len = urlsInPublic.length; i < len; i++) {
        url = urlsInPublic[i];
        file = path.join(this.publicFolder, url);
        if (!fs.lstatSync(file).isFile()) {
          continue;
        }
        if (!this._isType(url, "css|js")) {
          continue;
        }
        content = fs.readFileSync(file, 'utf-8');
        if (this._isType(url, "css")) {
          debug("fixing css-urls in " + file);
          content = content.replace(/url\('([^\)]+)'\)/g, "url($1)");
          content = content.replace(/url\("([^\)]+)"\)/g, "url($1)");
          content = content.replace(/url\(([^\)\#\?]+)([^\)]*)\)/g, replaceCSSURL);
        }
        debug("fixing sourceMapping-urls in " + file);
        content = content.replace(/# sourceMappingURL=(.*)\.map/g, replaceSourceMapURLs);
        results.push(fs.writeFileSync(file, content, 'utf-8'));
      }
      return results;
    };

    return HashBrunch;

  })();

}).call(this);
