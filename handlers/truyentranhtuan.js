var path = require('path');
var urlutil = require('url');

var utils = require('jul11co-wdt').Utils;

module.exports = {
  
  name: 'TruyenTranhTuan',
  website: 'http://truyentranhtuan.com',

  match: function(link, options) {
    return /truyentranhtuan\.com/g.test(link);
  },

  dispatch: function(saver, $, page, options, callback) {

    if (options.group_by_site && !options.orig_output_dir) {
      options.orig_output_dir = options.output_dir;
      options.output_dir = path.join(options.output_dir, 'TruyenTranhTuan');
      saver.setMangaOutputDir(options.output_dir);
    }

    if ($('#viewer').length) {
      page.title = $('title').first().text();
      if (page.title) {
        page.title = page.title.replace(/(\r\n|\n|\r)/gm, '');
      }

      // var chapter_title = $('#read-title').text();
      var chapter_title = page.title.replace(' - Truyện tranh online - truyentranhtuan.com','');

      var chapter_script = '';
      $('script').each(function() {
        chapter_script += $(this).html();
      });

      if (!chapter_script) {
        return callback();
      }

      var slides_type = 1;
      var tmp = utils.extractSubstring(chapter_script, 'var slides_page_path = [', '];');
      if (tmp == '') {
        slides_type = 2;
        tmp = utils.extractSubstring(chapter_script, 'var slides_page_url_path = [', '];');
      }
      tmp = utils.replaceAll(tmp,'"','');
      var tmp_images = tmp.split(",");
      if (slides_type == 1) {
        tmp_images.sort();
      }

      var image_file_names = [];
      var chapter_images = [];
      tmp_images.forEach(function(image_src) {
        var image_url = image_src;
        var image_url_obj = urlutil.parse(image_url);
        var image_file_name = path.basename(image_url_obj.pathname);
        if (image_file_name && image_file_name != '') {
          image_file_name = saver.getUniqueFileName(image_file_names, image_file_name);
          chapter_images.push({
            src: image_url,
            file: image_file_name
          });
        }
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

    } else if ($('#manga-chapter').length) {
      console.log('Chapter list');
      
      // if (options.group_by_site) {
      //   options.output_dir = path.join(options.output_dir, 'TruyenTranhTuan');
      //   saver.setMangaOutputDir(options.output_dir);
      // }

      if (options.auto_manga_dir) {
        var manga_title = $('#infor-box h1[itemprop="name"]').first().text().trim();
        console.log('Manga title: ' + manga_title);
        options.output_dir = path.join(options.output_dir, manga_title);
        saver.setMangaOutputDir(options.output_dir);
      }

      saver.setStateData('url', page.url);
      
      page.chapter_links = saver.getLinks($, page, '#manga-chapter');
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