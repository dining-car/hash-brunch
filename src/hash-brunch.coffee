crypto    = require 'crypto'
fs        = require 'fs'
path      = require 'path'
glob      = require 'glob'
imagesize = require 'image-size'

PRECISION=8
HASHEDFILE_PATTERN=/^(.+)-([0-9a-f]{6,})(\..*)$/

warn = (message) -> console.log "hash-brunch WARNING: #{message}"
debug = (message) -> #console.log "hash-brunch DEBUG: #{message}"

module.exports = class HashBrunch
  brunchPlugin: true

  constructor: (@config) ->
    # Defaults options
    @options = {
      precision: 8,
      assetFolder: "app/assets"
    }
    
    # Merge config
    cfg = @config.plugins?.hashbrunch ? {}
    @options[k] = cfg[k] for k of cfg
        
  _stripHash: (url) ->
    if path.basename(url).match(HASHEDFILE_PATTERN)
      url = url.replace(HASHEDFILE_PATTERN, "$1$3")
    url
    
  _isHashed: (url) -> path.basename(url).match(HASHEDFILE_PATTERN)
    
  _isType: (url, endings) -> url.search("^.+\.(" + endings + ")$") != -1

  _calculateHash: (file, digest) ->
    data = fs.readFileSync file
    shasum = crypto.createHash 'sha1'
    shasum.update(data)
    shasum.digest('hex')[0..@options.precision-1]
      
  onCompile: (generatedFiles) ->
    @publicFolder = @config.paths.public
    
    # 1. clean public folder
    urlsInPublic = glob.sync('**', { cwd: @publicFolder })
    urlsInAssets = glob.sync('**', { cwd: @options.assetFolder })
    for url in urlsInPublic
      file = path.join(@publicFolder, url)      
      continue unless fs.lstatSync(file).isFile()
      
      # delete assets that aren't in src
      if ((!@_isType(url,"css|map|js")) and not (@_stripHash(url) in urlsInAssets))
        debug "deleting #{file}: assetRemoved"
        fs.unlinkSync(file)
        continue
      
      # delete hashed files where there is a newer version
      if @_isHashed(url) and (@_stripHash(url) in urlsInPublic)
        debug "deleting #{file}: newVersion"
        fs.unlinkSync(file)
        continue
        
    # 2. hash and rename (non css,js) files
    urlsInPublic = glob.sync('**', { cwd: @publicFolder })
    for url in urlsInPublic
      file = path.join(@publicFolder, url)      
      continue unless fs.lstatSync(file).isFile()
      continue if @_isType(url, "js|css")
      continue if @_isHashed(url)
      
      hash = @_calculateHash(file)      
      urlInfo = path.parse(url)
      newUrl = path.join(urlInfo.dir, urlInfo.name + '-' + hash + urlInfo.ext)
      debug "rename #{url} -> #{newUrl}"
      fs.renameSync(path.join(@publicFolder, url), path.join(@publicFolder, newUrl))
    
    # 3. create digest and do image-size
    digest = {}
    urlsInPublic = glob.sync('**', { cwd: @publicFolder })
    for url in urlsInPublic
      file = path.join(@publicFolder, url)      
      continue unless fs.lstatSync(file).isFile()
      continue if @_isType(url, "js|css")
      throw "#{file} is not hashed!" unless @_isHashed(file)
      
      digest[@_stripHash(url)] =
        url: url
        
      # imagesize
      try
        imgSize = imagesize(file)
        digest[@_stripHash(url)].imgSize = [imgSize.width, imgSize.height]
      catch error
          
    # 4. fix urls in css and sourceMapping
    @_fixUrls(digest)
    
    # 5. hash and rename css and js
    urlsInPublic = glob.sync('**', { cwd: @publicFolder })
    for url in urlsInPublic
      file = path.join(@publicFolder, url)      
      continue unless fs.lstatSync(file).isFile()      
      continue unless @_isType(url, "css|js")

      hash = @_calculateHash(file)
      urlWithoutHash = @_stripHash(url)
      urlInfo = path.parse(urlWithoutHash)
      newUrl = path.join(urlInfo.dir, urlInfo.name + '-' + hash + urlInfo.ext)
      debug "rename #{url} -> #{newUrl}"
      fs.renameSync(path.join(@publicFolder, url), path.join(@publicFolder, newUrl))
      
      digest[urlWithoutHash] =
        url: newUrl
      
    # 6. write manifest
    manifestPath = path.join(@publicFolder, "..", "asset-manifest.json")
    fs.writeFileSync(manifestPath, JSON.stringify(digest, null, 4))
    
  _fixUrls: (digest) ->
    replaceCSSURL = (match, url, suffix) ->
      # suffix: ?eof, or #font-name
      
      if url.match(HASHEDFILE_PATTERN)
        url = url.replace(HASHEDFILE_PATTERN, "$1$3")
        
      if digest[url] != undefined
        newUrl = digest[url].url + suffix
        debug "css: url-rewrite #{url} -> #{newUrl}"
        url = newUrl
      else
        url = url + suffix
      
      return "url(#{url})"
      
    replaceSourceMapURLs = (match, capture) ->
      url = capture + ".map"
      if url.match(HASHEDFILE_PATTERN)
        url = url.replace(HASHEDFILE_PATTERN, "$1$3")

      if digest[url] != undefined
        newUrl = digest[url].url
        debug "sourceMap rewrite #{url} -> #{newUrl}"
        url = newUrl
      
      return "# sourceMappingURL=#{url}"
                
    urlsInPublic = glob.sync('**', { cwd: @publicFolder })
    for url in urlsInPublic
      file = path.join(@publicFolder, url)      
      continue unless fs.lstatSync(file).isFile()      
      continue unless @_isType(url, "css|js")

      content = fs.readFileSync(file, 'utf-8')
      if @_isType(url, "css")
        debug "fixing css-urls in #{file}"
        content = content.replace(/url\('([^\)]+)'\)/g, "url($1)")
        content = content.replace(/url\("([^\)]+)"\)/g, "url($1)")
        content = content.replace(/url\(([^\)\#\?]+)([^\)]*)\)/g, replaceCSSURL)
        
      debug "fixing sourceMapping-urls in #{file}"
      content = content.replace(/# sourceMappingURL=(.*)\.map/g, replaceSourceMapURLs)
      fs.writeFileSync(file, content, 'utf-8');    
