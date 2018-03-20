var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'TruyenTranh8',
  website: 'http://truyentranh8.net',

  match: function(link, options) {
    return /truyentranh8\./g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'TruyenTranh8');
      saver.setMangaOutputDir(options.output_dir);
    }

    // saver.saveHtmlFile($, page, options);

    var extractImageList = function(string) {

      var tmp_arr = string.match(/lstImages\.push(.*?)(?=[;]|$)/g);
      if (!tmp_arr) {
        // console.log('No chapter script available');
        return [];
      }
        
      var tmp_images = [];
      for (var i = 0; i < tmp_arr.length; i++) {
        tmp_arr[i] = utils.replaceAll(tmp_arr[i], 'lstImages.push("', '');
        tmp_arr[i] = utils.replaceAll(tmp_arr[i], '")', '');
        tmp_images.push(tmp_arr[i]);
      }

      return tmp_images;
    }

    if ($('.xemtruyen').length) {
      page.title = $('title').first().text();
      if (page.title) {
        page.title = page.title.replace(/(\r\n|\n|\r)/gm, '');
      }

      var chapter_title = $('.TitleH2').text();

      console.log('Chapter title:', chapter_title);

      var chapter_script = $.html('script');
      if (!chapter_script) {
        console.log('No chapter script available');
        return callback();
      }

      if (options.verbose) console.log(chapter_script);

      var tmp_images = [];
      var tmp_arr = chapter_script.match(/lstImages\.push(.*?)(?=[;]|$)/g);
      if (tmp_arr) {
        for (var i = 0; i < tmp_arr.length; i++) {
          tmp_arr[i] = utils.replaceAll(tmp_arr[i], 'lstImages.push("', '');
          tmp_arr[i] = utils.replaceAll(tmp_arr[i], '")', '');
          tmp_images.push(tmp_arr[i]);
        }
      } else {
        var tmp_eval_code = /eval(\(.*\))/g.exec(chapter_script);
        if (tmp_eval_code) {
          var image_script = eval(tmp_eval_code[1]);
          eval(image_script);
          tmp_images = lstImages;
        }
      }
        
      if (tmp_images.length == 0) {
        return callback();
      }

      var image_file_names = [];
      var chapter_images = [];
      tmp_images.forEach(function(image_src) {
        var image_url = image_src;
        // console.log('Image URL: ' + image_url);
        var image_url_obj = urlutil.parse(image_url);
        var image_file_name = path.basename(image_url_obj.pathname);
        image_file_name = saver.getUniqueFileName(image_file_names, image_file_name);
        chapter_images.push({
          src: image_url,
          file: image_file_name
        });
      });
      if (options.verbose) console.log(chapter_images);

      saver.downloadMangaChapter({
        chapter_url: page.url,
        chapter_title: chapter_title,
        chapter_images: chapter_images,
        output_dir: page.output_dir
      }, options, function(err) {
        if (err) return callback(err);
        callback();
      });

    } else if ($('#ChapList').length) {
      console.log('Chapter list');

      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'TruyenTranh8');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        var manga_title = $('h1.TitleH2').first().text().trim();
        manga_title = utils.replaceAll(manga_title, 'Truyện Tranh', '').trim();
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);

      page.chapter_links = saver.getLinks($, page, '#ChapList');
      if (options.verbose) console.log(page.chapter_links);

      console.log(page.chapter_links.length + ' chapters');
      saver.processPages(page.chapter_links, options, function(err) {
        if (err) return callback(err);
        callback();
      });
    } else {
      callback();
    }
  }
}