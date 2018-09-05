var path = require('path');
var urlutil = require('url');

var moment = require('moment');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'Imgur',
  website: 'https://imgur.com/',

  match: function(link, options) {
    return /imgur\.com\/a\//g.test(link) || /imgur\.com\/gallery\//g.test(link)
       || /imgur\.com\/t\//g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'Imgur');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    if (/imgur\.com\/gallery\//g.test(page.url)) {
      var gallery_id = page.url.replace('https://imgur.com/gallery/', '');
      gallery_id = gallery_id.replace('http://imgur.com/gallery/', '');

      options.gallery_url = page.url;

      if (options.verbose) console.log('Gallery ID: ' + gallery_id); 
      var links = [
        'https://imgur.com/a/' + gallery_id + '/layout/blog'
      ];

      saver.processPages(links, options, function(err) {
        if (err) return callback(err);
        callback();
      });
      return;
    }
    else if (/imgur\.com\/t\//g.test(page.url)) {
      var gallery_id = path.basename(page.url);
      options.gallery_url = page.url;

      if (options.verbose) console.log('Gallery ID: ' + gallery_id); 
      var links = [
        'https://imgur.com/a/' + gallery_id + '/layout/blog'
      ];

      saver.processPages(links, options, function(err) {
        if (err) return callback(err);
        callback();
      });
      return;
    }

    var post_title = '';
    if ($('.post-title').length) {
      post_title = $('.post-title').text().trim();
    }

    var script = $('script').text();
    
    var galleryData = utils.extractSubstring(script, 'window.runSlots = {', '};');
    galleryData = '{' + galleryData + '}';

    galleryData = utils.replaceAll(galleryData, "_config:", "\"_config\":");
    galleryData = utils.replaceAll(galleryData, "_place:", "\"_place\":");
    galleryData = utils.replaceAll(galleryData, "_item:", "\"_item\":");

    galleryData = utils.replaceAll(galleryData, "config:", "\"_config\":");
    galleryData = utils.replaceAll(galleryData, "place:", "\"_place\":");
    galleryData = utils.replaceAll(galleryData, "item:", "\"_item\":");

    var galleryDataObj;
    try {
      galleryDataObj = JSON.parse(galleryData);
    } catch(e) {
      // console.log(e);
    }

    if (galleryDataObj && galleryDataObj._item) {

      var post_title = galleryDataObj._item.title || post_title || page.title;
      if (options.verbose) console.log('Gallery: ', post_title);

      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, post_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      var chapter_output_dir = path.join(options.output_dir, path.basename(page.url.replace('/layout/blog','')));

      var post_images = [];
      if (galleryDataObj._item.album_images && galleryDataObj._item.album_images.images) {

        for (var i = 0; i < galleryDataObj._item.album_images.images.length; i++) {
          var image_data = galleryDataObj._item.album_images.images[i];
          post_images.push({
            hash: image_data.hash,
            ext: image_data.ext.split('?')[0],
            title: image_data.title,
            desc: image_data.description,
            width: image_data.width,
            height: image_data.height,
            size: image_data.size,
            datetime: image_data.datetime
          });
        }
        if (options.debug) console.log(post_images);

        var images = [];
        post_images.forEach(function(post_image) {
          images.push({
            src: 'https://i.imgur.com/' + post_image.hash + post_image.ext,
            file: post_image.hash + post_image.ext,
          });
        });
        if (options.debug) console.log(images);

        saver.downloadMangaChapter({
          chapter_url: options.chapter_url || page.url,
          chapter_title: post_title,
          chapter_images: images,
          output_dir: chapter_output_dir
        }, options, function(err) {
          if (err) {
            return callback(err);
          }

          var gallery_info_text = '';
          gallery_info_text += 'URL: ' + (options.gallery_url || page.url || '') + '\r\n';
          gallery_info_text += 'Name: ' + post_title + '\r\n';
          if (options.auto_manga_dir) {
            saver.saveTextSync(path.join(options.output_dir, 'imgur.txt'), gallery_info_text);
          } else {
            saver.saveTextSync(path.join(chapter_output_dir, 'imgur.txt'), gallery_info_text);
          }

          return callback();
        });
      } else if (galleryDataObj._item.hash /*&& galleryDataObj._item.mimetype*/ && galleryDataObj._item.ext) {
        if (options.verbose) console.log('Single image:', page.url);

        post_images.push({
          src: 'http://i.imgur.com/' + galleryDataObj._item.hash + galleryDataObj._item.ext,
          file: galleryDataObj._item.hash + galleryDataObj._item.ext
        });
        if (options.debug) console.log(post_images);

        saver.downloadMangaChapter({
          chapter_url: options.chapter_url || page.url,
          chapter_title: post_title,
          chapter_images: images,
          output_dir: chapter_output_dir          
        }, options, function(err) {
          if (err) {
            return callback(err);
          }

          var gallery_info_text = '';
          gallery_info_text += 'URL: ' + (options.gallery_url || page.url || '') + '\r\n';
          gallery_info_text += 'Name: ' + post_title + '\r\n';
          if (options.auto_manga_dir) {
            saver.saveTextSync(path.join(options.output_dir, 'imgur.txt'), gallery_info_text);
          } else {
            saver.saveTextSync(path.join(chapter_output_dir, 'imgur.txt'), gallery_info_text);
          }

          return callback();
        });
      } else {
        return callback();
      }      
    } else if ($('.post-images').length) {

      var post_title = utils.replaceAll(page.title.trim(), ' - Imgur', '');

      if (options.auto_manga_dir) {
        options.output_dir = path.join(options.output_dir, post_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      var chapter_output_dir = path.join(options.output_dir, path.basename(page.url));

      saver.fixImages($, page, '.post-images');

      var post_images = [];
      $('.post-images .post-image-container').each(function() {
        var $post_image = $(this).find('.post-image');
        var $post_image_meta = $(this).find('.post-image-meta');

        var img_src = $post_image.find('img').first().attr('src');
        if (img_src && img_src != '') {
          post_images.push({
            src: img_src,
            desc: $post_image_meta.find('.post-image-description').text().trim()
          });
        }
      });

      var images = saver.getImages($, page, '.post-images .post-image');
      if (options.debug) console.log(images);

      saver.downloadMangaChapter({
        chapter_url: options.chapter_url || page.url,
        chapter_title: post_title,
        chapter_images: images,
        output_dir: chapter_output_dir          
      }, options, function(err) {
        if (err) {
          return callback(err);
        }

        var gallery_info_text = '';
        gallery_info_text += 'URL: ' + (options.gallery_url || page.url || '') + '\r\n';
        gallery_info_text += 'Name: ' + post_title + '\r\n';
        if (options.auto_manga_dir) {
          saver.saveTextSync(path.join(options.output_dir, 'imgur.txt'), gallery_info_text);
        } else {
          saver.saveTextSync(path.join(chapter_output_dir, 'imgur.txt'), gallery_info_text);
        }

        callback();
      });
    } else {
      callback();
    }
  }
}
