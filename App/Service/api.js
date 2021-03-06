var async = require('async');

var db = require('../DB/Sqlite');

var User = require('./user');
var Note = require('./note');
var Tag = require('./tag');
var Notebook = require('./notebook');
var Common = require('./common');
var Web = require('./web');
var needle = {}; // require('needle');
var fs = {}; // require('fs');
var Evt = require('./evt');

var Tags = db.tags;

function log(o) {
	console.log(o);
}
// log(Common);
// log(db);
// log("??")

// timeout 0无限等待, 60,000 1分钟
/*
needle.defaults({
	timeout: 60000
});
*/

// 用Fetcher来操作网络数据

// 远程数据服务
var Api = {
	// 检查错误
	checkError: function(error, resp) { 
		var me = this;
		me.unConnected(error);
		// console.error(error);
		// 是否需要重新登录
		/*{
		  "Ok": false,
		  "Code": 1,
		  "Msg": "NOTLOGIN",
		  "Id": "",
		  "List": null,
		  "Item": null
		}*/
		var ret = resp;
		try {
			if(typeof ret == 'object') {
				if(!ret['Ok'] && ret['Msg'] == 'NOTLOGIN') {
					Web.notLogin();
				}
			} else {
				// 出现问题
				Web.unConnected();
			}
		} catch(e) {
			// 出错问题
			Web.unConnected();
		}
	},
	// 是否断网
	unConnected: function(error) {
		var me = this;
		if(error && (error.code == "ECONNREFUSED" || error.code == 'ECONNRESET')) { // socket hand up
			// console.error('---------------------')
			console.error(error);
			Web.unConnected();
			return true;
		}
		return false;
	},
	getUrl: function(url, param) {
		if(!User) {
		}
		var url = Evt.leanoteUrl + '/api/' + url;
		var token = User.getToken();
		param = param || {};
		param.token = token;
		if(param) {
			var paramStr = '';
			for(var i in param) {
				paramStr += i + '=' + encodeURI(param[i]) + '&';
			}
		}
		if(url.indexOf('?') >= 0) {
			url =  url + '&' + paramStr;
		}
		url =  url + '?' + paramStr;
		return url;
	},

	// get
	get: function(url, param, callback) {
		console.log(this.getUrl(url, param));
		fetch(this.getUrl(url, param), {method: 'GET'})
	      .then((response) => response.json())
	      .then(function(ret) {
	      	if(Common.isOk(ret)) {
				callback && callback(ret);
			} else {
				callback && callback(false);
			}
	      })
	      .catch((err) => {
	        console.log(err);
	        return callback && callback(false);
	      })
	      .done();
	},

	// post
	post: function(url, param, callback) {
		fetch(this.getUrl(url, param), {method: 'POST'})
	      .then((response) => response.json())
	      .then(function(ret) {
	      	if(Common.isOk(ret)) {
				callback && callback(ret);
			} else {
				callback && callback(false);
			}
	      })
	      .catch((err) => {
	        console.log(err);
	        return callback && callback(false);
	      })
	      .done();
	},

	// 登录
	// [ok]
	auth: function(email, pwd, host, callback) { 
		var me = this;

		// 设置server host
		Evt.setHost(host);

		this.post('auth/login', {email: email, pwd: pwd}, function(ret) {
			if(ret) {
				ret.Pwd = pwd;
				ret['Host'] = Evt.leanoteUrl;
				User.setCurUser(ret);
				callback && callback(ret);
			} else {
				callback && callback(false);
			}
		});
	},

	// ===================
	// 获取型接口
	// ===================
	
	// 获取需要同步的笔记本
	getSyncNotebooks: function(afterUsn, maxEntry, callback) {
		var me = this;
		this.get('notebook/getSyncNotebooks', {afterUsn: afterUsn, maxEntry: maxEntry}, function(ret) {
			console.log('notebook/getSyncNotebooks');
			console.log(ret);
			callback && callback(ret);
		});
	},
	getSyncNotes: function(afterUsn, maxEntry, callback) {
		var me = this;
		var url = this.getUrl('note/getSyncNotes', {afterUsn: afterUsn, maxEntry: maxEntry});
		console.log(url);
		this.get('note/getSyncNotes', {afterUsn: afterUsn, maxEntry: maxEntry}, function(ret) {
			console.log('note/getSyncNotes');
			ret && console.log(ret.length);
			callback && callback(ret);
		});
	},
	getSyncTags: function(afterUsn, maxEntry, callback) {
		var me = this;
		var url = this.getUrl('tag/getSyncTags', {afterUsn: afterUsn, maxEntry: maxEntry});
		console.log(url);

		this.get('tag/getSyncTags', {afterUsn: afterUsn, maxEntry: maxEntry}, function(ret) {
			console.log('tag/getSyncTags');
			console.log(ret);
			callback && callback(ret);
		});
	},

	// 获取服务端usn状态
	// 要考虑重发
	getLastSyncState: function(callback) {
		var me = this;
	    
	    this.get('user/getSyncState', {}, function(ret) {
			console.log('user/getSyncState');
			console.log(ret);
			callback && callback(ret);
		});

	    /*
		needle.get(url, {timeout: 10000}, function(error, response) {
			// console.log('user/getSyncState ret');
			me.checkError(error, response);
			if(error) {
				return callback && callback(false);
			}
			var ret = response.body;
			console.log('--getSyncState--ret---')
			console.log(ret);
			if(Common.isOk(ret)) {
				callback && callback(ret);
			} else {
				callback && callback(false);
			}
		});
		*/
	},

	// 获取笔记内容, 获取之后保存到笔记中
	getNoteContent: function(noteId, callback) {
		var me = this;
		var url = this.getUrl('note/getNoteContent', {noteId: noteId});
		console.log(url);
		
		this.get('note/getNoteContent', {noteId: noteId}, function(ret) {
			console.log('note/getNoteContent');
			// console.log(ret);
			callback && callback(ret);
		});
	},

	// TODO
	// get图片, 获取内容后, 得到所有图片链接, 异步去获取图片, 并修改图片链接, 
	// 将https://leanote.com/api/resource/getImage?imageId=xx
	// 转成app://leanote/public/files, 内部可以是个服务器吗? 请求内部的controller
	getImage: function(fileId, callback) {
		var me = this;
		var url = me.getUrl('file/getImage', {fileId: fileId});
		log(url);
		needle.get(url, function(err, resp) {
			me.checkError(err, resp);
			if(err) {
				return callback && callback(false);
			}
			// log(resp.body);
			/*
			{ 'accept-ranges': 'bytes',
			  'content-disposition': 'inline; filename="logo.png"',
			  'content-length': '8583',
			  'content-type': 'image/png',
			  date: 'Mon, 19 Jan 2015 15:01:47 GMT',
  			*/
			// log(resp.headers);
			if(err) {
				callback(false);
			} else {
				var typeStr = resp.headers['content-type'];
				var type = 'png';
				if(typeStr) {
					var typeArr = typeStr.split('/');
					if(typeStr.length > 1) {
						type = typeArr[1];
					}
				}

				var filename = Common.uuid() + '.' + type;
				var imagePath = User.getCurUserImagesPath();
				var imagePathAll = imagePath + '/' + filename;
				log(imagePathAll);
				fs.writeFile(imagePathAll, resp.body, function(err) {
					if(err) {
						log(err);
						log('local save image failed 本地保存失败');
						callback(false);
					} else {
						callback(imagePathAll, filename);
					}
				});
			}
		});
	},

	// 获取附件
	// TODO
	// FileService调用
	getAttach: function(serverFileId, callback) {
		var me = this;
		var url = me.getUrl('file/getAttach', {fileId: serverFileId});
		console.log(url);
		needle.get(url, function(err, resp) {
			me.checkError(err, resp);
			if(err) {
				return callback && callback(false);
			}
			// log(resp.body);
			/*
			{ 'accept-ranges': 'bytes',
			  'content-disposition': 'inline; filename="logo.png"',
			  'content-length': '8583',
			  'content-type': 'image/png', ""
			  date: 'Mon, 19 Jan 2015 15:01:47 GMT',

			  'accept-ranges': 'bytes',
			  'content-disposition': 'attachment; filename="box.js"',
			  'content-length': '45503',
			  'content-type': 'application/javascript',
  			*/
			// console.log(resp.headers);
			// return;
			if(err) {
				callback(false);
			} else {
				// TODO 这里, 要知道文件类型
				var typeStr = resp.headers['content-type'];
				var contentDisposition = resp.headers['content-disposition'];
				var matches = contentDisposition.match(/filename="(.+?)"/);
				var filename = matches && matches.length == 2 ? matches[1] : "";
				// log(resp.headers);
				// log(typeStr);
				var type = '';
				if(filename) {
					type = filename.split('.').pop();
				}
				if(!filename && typeStr) {
					var typeArr = typeStr.split('/');
					if(typeStr.length > 1) {
						type = typeArr[1];
					}
				}

				var filename = Common.uuid() + '.' + type;
				var attachPath = User.getCurUserAttachsPath();
				var attachPathAll = attachPath + '/' + filename;
				log(attachPathAll);
				fs.writeFile(attachPathAll, resp.body, function(err) {
					if(err) {
						log(err);
						log('local save attach failed 本地保存失败');
						callback(false);
					} else {
						callback(true, attachPathAll, filename);
					}
				});
			}
		});
	},

	// ==================
	// 操作型接口
	// ==================

	//------------
	// 笔记本操作
	//------------
	// 添加
	addNotebook: function(notebook, callback) {
		var me = this;
		// notebook.ParentNotebookId是本的, 要得到远程的
		Notebook.getServerNotebookIdByNotebookId(notebook.ParentNotebookId, function(serverNotebookId) {
			var data = {
				title: notebook.Title,
				seq: notebook.Seq,
				parentNotebookId: serverNotebookId
			}
			console.log('add notebook');
			console.log(data);
			needle.post(me.getUrl('notebook/addNotebook'), data, {}, function(err, resp) {
				me.checkError(err, resp);
				if(err) {
					return callback(false);
				}
				var ret = resp.body;
				console.log(ret);
				if(Common.isOk(ret)) {
					callback(ret);
				} else {
					callback(false);
				}
			});	
		});
	},
	// 更新
	updateNotebook: function(notebook, callback) {
		var me = this;
		Notebook.getServerNotebookIdByNotebookId(notebook.ParentNotebookId, function(serverNotebookId) {
			var data = {
				notebookId: notebook.ServerNotebookId,
				title: notebook.Title,
				usn: notebook.Usn,
				seq: notebook.Seq,
				parentNotebookId: serverNotebookId || ""
			}
			log('update notebook');
			log(data);
			needle.post(me.getUrl('notebook/updateNotebook'), data, {}, function(err, resp) {
				me.checkError(err, resp);
				if(err) {
					log('err');
					log(err);
					return callback(false);
				}
				var ret = resp.body;
				log('update notebook ret:');
				log(ret);
				if(Common.isOk(ret)) {
					callback(ret);
				} else {
					callback(false);
				}
			});
		});
	},

	// 删除
	deleteNotebook: function(notebook, callback) {
		var me = this;
		var data = {notebookId: notebook.ServerNotebookId, usn: notebook.Usn};
		log('delete notebook');
		needle.post(me.getUrl('notebook/deleteNotebook'), data, {timeout: 10000}, function(err, resp) {
			me.checkError(err, resp);
			if(err) {
				return callback(false);
			}
			var ret = resp.body;
			log('delete notebook ret');
			log(ret);
			if(Common.isOk(ret)) {
				// 以后不要再发了
				Notebook.setNotDirty(notebook.NotebookId);
				callback(ret);
			} else {
				callback(false);
				try {
					log('delete notebook conflict');
					// 代表冲突了, 那么本地的删除无效, 设为IsDirty为false, 不删除
					// 待以后同步
					if(ret.Msg == 'conflict') {
						log('delete notebook conflict: setNotDirtyNotDelete');
						Notebook.setNotDirtyNotDelete(notebook.NotebookId);
					} else {
						log('delete notebook conflict: setNotDirty');
						Notebook.setNotDirty(notebook.NotebookId);
					}

				} catch(e) {}
			}
		});
	},

	//---------
	// note
	//--------

	// 获取笔记
	// noteId是serverNoteId
	getNote: function(noteId, callback) {
		var me = this;
		needle.get(me.getUrl('note/getNote', {noteId: noteId}), function(error, response) {
			me.checkError(error, response);
			if(error) {
				return callback && callback(false);
			}
			var ret = response.body;
			if(Common.isOk(ret)) {
				callback && callback(ret);
			} else {
				console.error(error);
				console.log(me.getUrl('note/getNote', {noteId: noteId}));
				callback && callback(false);
			}
		});
	},

	// 添加笔记
	// 要把文件也发送过去
	addNote: function(note, callback) {
		var me = this;
		// note.NotebookId是本的, 要得到远程的
		Notebook.getServerNotebookIdByNotebookId(note.NotebookId, function(serverNotebookId) {
			if(!serverNotebookId) {
				console.error('No serverNotebookId');
				console.log(note);
				callback && callback(false);
				return;
			}
			var data = {
				Title: note.Title,
				NotebookId: serverNotebookId,
				Content: note.Content,
				IsMarkdown: note.IsMarkdown,
				Tags: note.Tags,
				// IsBlog: false, // TODO 这里永远设为非blog note.IsBlog,
				IsBlog: note.IsBlog,
				Files: note.Files,
				FileDatas: note.FileDatas,
			}
			// log('add note');
			// log(data);

			// files处理
			var needMultiple = false;
			for(var i in data.FileDatas) {
				needMultiple = true;
				break;
			}

			// 最终传递的数据
			console.log('end transfer data');
			console.log(data);


			try {
				needle.post(me.getUrl('note/addNote'), data, 
					{
						multipart: needMultiple
					}, 
					function(err, resp) {
					me.checkError(err, resp);
					if(err) {
						console.error('add note error!!-------');
						console.error(err);
						return callback(false);
					}
					var ret = resp.body;
					console.log('add note ret');
					console.log(ret);
					console.log('add note ret<-');
					if(Common.isOk(ret)) {
						// 将serverId保存
						callback(ret);
					} else {
						callback(false);
					}
				});
			} catch(e) {
				console.log('add note needle error');
				console.log(e);
			};
		});
	},

	// 更新
	updateNote: function(note, callback) {
		var me = this;
		Notebook.getServerNotebookIdByNotebookId(note.NotebookId, function(serverNotebookId) {
			if(!note.Tags || note.Tags.length == 0) {
				note.Tags = [''];
			}
			var data = {
				NoteId: note.ServerNoteId,
				NotebookId: serverNotebookId || "",
				Title: note.Title,
				Usn: note.Usn,
				IsTrash: note.IsTrash,
				IsBlog: note.IsBlog, // 是否是博客
				Files: note.Files,
				FileDatas: note.FileDatas,
				Tags: note.Tags, // 新添加
			};

			// 内容不一样才发内容
			if(note.ContentIsDirty) {
				data.Content = note.Content;

				// 如果是markdown笔记, 则摘要也要传过去
				if(note.IsMarkdown) {
					data.Abstract = note.Abstract;
				}
			}

			console.log('update note :');
			console.log(data);

			// files处理
			var needMultiple = false;
			for(var i in data.FileDatas) {
				needMultiple = true;
				break;
			}

			needle.post(me.getUrl('note/updateNote'), data, {multipart: needMultiple}, function(err, resp) {
				// console.log('update note ret------------------');
				me.checkError(err, resp);
				if(err) {
					console.error('err');
					console.log(err);
					return callback(false);
				}
				var ret = resp.body;
				// console.log('update note ret:');
				// console.log(ret);
				// console.log(ret.Files);
				// 没有传IsMarkdown, 后台会传过来总为false
				delete ret['IsMarkdown'];
				callback(ret);
				/*
				if(Common.isOk(ret)) {
				} else {
					callback(false);
				}
				*/
			});
		});
	},

	// 删除
	deleteTrash: function(note, callback) {
		var me = this;
		var data = {noteId: note.ServerNoteId, usn: note.Usn};
		log('delete note');
		// 这里要重新require下, 不然为{}
		Note = require('note');
		needle.post(me.getUrl('note/deleteTrash'), data, {timeout: 10000}, function(err, resp) {
			me.checkError(err, resp);
			if(err) {
				return callback(false);
			}
			var ret = resp.body;
			console.error('delete note ret');
			console.log('delete note ret');
			console.log(ret);
			if(Common.isOk(ret)) {
				// 以后不要再发了
				Note.removeNote(note.NoteId);
				callback(ret);
			} else {
				callback(false);
				try {
					console.log('delete note conflict');
					// 代表冲突了, 那么本地的删除无效, 设为IsDirty为false, 不删除
					// 待以后同步
					if(ret.Msg == 'conflict') {
						console.log('delete note conflict: setNotDirtyNotDelete');
						Note.setNotDirtyNotDelete(note.NoteId);
					} else if(ret.Msg == 'notExists') {
						console.log('delete note conflict: remove not exists');
						Note.removeNote(note.NoteId);
					} else {
						console.log('delete note conflict: setNotDirty');
						Note.setNotDirty(note.NoteId);
					}
				} catch(e) {}
			}
		});
	},

	exportPdf: function(noteId, callback) {
		var me = this;
		console.log(me.getUrl('note/exportPdf', {noteId: noteId}));
		needle.get(me.getUrl('note/exportPdf', {noteId: noteId}), function(err, resp) {
			me.checkError(err, resp);
			if(err) {
				return callback && callback(false);
			}
			// log(resp.body);
			/*
			{ 'accept-ranges': 'bytes',
			  'content-disposition': 'inline; filename="logo.png"',
			  'content-length': '8583',
			  'content-type': 'image/png',
			  date: 'Mon, 19 Jan 2015 15:01:47 GMT',
  			*/
  		
  			var body = resp.body;
  			if(typeof body == "object" && body.Msg === false) {
  				return callback(false, "", body.Msg);
  			}
			
			var filename = Common.uuid() + '.pdf';
			var imagePath = User.getCurUserImagesPath();
			var imagePathAll = imagePath + '/' + filename;
			fs.writeFile(imagePathAll, resp.body, function(err) {
				if(err) {
					log(err);
					log('local save pdf failed 本地保存失败');
					callback(false);
				} else {
					callback(imagePathAll, filename);
				}
			});
		});
	},

	// 添加标签
	addTag: function(title, callback) {
		var me = this;
		needle.post(me.getUrl('tag/addTag'), {tag: title}, {}, function(err, resp) {
			me.checkError(err, resp);
			if(err) {
				return callback && callback(false);
			}
			var ret = resp.body;
			console.log('add tag ret ==========');
			console.log(ret);
			if(Common.isOk(ret)) {
				// Tag.setNotDirty(title);
				// 更新, 添加usn
				Tag.setNotDirtyAndUsn(title, ret.Usn);
				callback && callback(ret);
			} else {
				callback && callback(false);
			}
		});
	},
	// 删除标签
	deleteTag: function(tag, callback) {
		var me = this;
		needle.post(me.getUrl('tag/deleteTag'), {tag: tag.Tag, usn: tag.Usn}, {timeout: 10000}, function(err, resp) {
			me.checkError(err, resp);
			if(err) {
				return callback && callback(false);
			}
			var ret = resp.body;
			log('delete tag ret ===========');
			log(ret);
			if(Common.isOk(ret)) {
				// 以后不要再发了
				Tag.setNotDirty(tag.Tag);
				callback && callback(ret);
			} else {
				// 出错了也不要发了, 万一是网络原因呢? 
				if(ret.Msg == 'conflict') {
					Tag.setNotDirty(tag.Tag);
				}
				callback && callback(false);
			}
		});
	},

	test: function() {
		log("??");
		Note = require('note');
		log(Note);
	}

};
module.exports = Api;
