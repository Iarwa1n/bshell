var bs_gui = function(shell)
{
	this.shell = shell;
	this.show = function()
	{

	}
}

var bs_shell = function()
{
	var v = new Object(); // all variables
	var h = new Array(); //history
	var c = new Object(); //all known commands

	c.test = function(cmd, input, params, shell)
	{
		console.log("i am " + cmd);
		console.log("i got " + input.length + " inputs");
		console.log("my params are " + params);
		return true; 	
	}
	
	c.max = function(cmd, input, params, shell)
	{
		if (!input.length) {
			return false;
		}

		var abs = function(num) {
			return (params.abs == "true") ? Math.abs(parseFloat(num)) : parseFloat(num);
		}		
		max = abs(input[0]);		 
		for( var i = 0; i < input.length; i++) {
			max = (abs(input[i]) > max) ? abs(input[i]) : max;
		}
		return max;
	}


	c.links = function(cmd, input, params, shell)
	{
		renderLinks = function() {
			var links = "";
			for (var i=0; i < top.frames[1].document.links.length; i++) {
				var link =  top.frames[1].document.links[i];
				links += "HREF: <a target='_blank' href='" + link.href + "'>" + link.href + "</a> -- Inner: " + link.innerHTML + "<br />";
			}
			var newDoc = top.frames[1].document.open("text/html", "replace");
			newDoc.write(links);
			newDoc.close();
		}

		if(input.length == 0) {
			renderLinks();
		} else {
			var _html = shell.exec(":bg load " + input[0]);
			var newDoc = top.frames[1].document.open("text/html", "replace");
			newDoc.write(_html);
			newDoc.close();
			var readyStateCheckInterval = setInterval(function() {
			    if (top.frames[1].document.readyState === "complete") {
					renderLinks();
			        clearInterval(readyStateCheckInterval);
			    }
			}, 10);		
		}
	}

	c.load = function(cmd, input, params, shell)
	{
		console.log(shell);
		console.log(input);
		var _html = shell.exec(":bg load " + input[0]);
		var newDoc = top.frames[1].document.open("text/html", "replace");
		newDoc.write(_html);
		newDoc.close();
	}

	/**
	* adds a command to the shell
	*/
	this.addCommand = function(command, call_back)
	{
		if(typeof call_back != "function") {
			return false;
		}
		c[command] = call_back;
		return true;
	}
	
	this.addVariable = function(key, value)
	{
		v[key] = value;
	}

	/**
	*folds double quoted texts to variables to ease tokenizing
	*/
	this.foldQuoted = function(cl_orig, cl, state, _start, _end, var_cnt, tokens) {
		
		if (cl.length == 0) {
			//console.log(cl_orig, tokens);
			return [cl_orig, tokens];
		}
		var letter = cl.shift();
		
		switch(state) {
			case 0:
				switch(letter) {
					case " ":
						break;
					case '"':
						state = 1;       //start found
						_end = _start;
						break;
					default:
						 break;
				}
				break;
			case 1:
				switch(letter) {
					case " ":
						break;
					case '"': //end found
						tokens[var_cnt] = cl_orig.slice(_start+1, _end); 
						cl_orig = cl_orig.slice(0, _start) + "$_" + (var_cnt++) + cl_orig.slice(_end+1);						
						_start 	= _start + 3; //variable name shift
						_end 	= 0;
						state 	= 0;
						break;
					case "\\":
						state = 2;						
					default:
						break;						
				}
				break;					
			case 2:
				//always go on
				state = 1;
				break;							 
		}
		
		if(_end == 0) {
			_start++;
		} else {
			_end++;
		}
		//console.log(cl_orig, cl, state, _start, _end, var_cnt, tokens);		
		return this.foldQuoted(cl_orig, cl, state, _start, _end, var_cnt, tokens);
	}
	
	
	/**
	* parses the command after quoted textes have been folded
	* cl the command line
	**/	
	this.parse = function(cl)
	{
		cl = cl.replace(/^\s+|\s+$/g,"") //trim whitespace from beginning and end
		var foldQuotes = this.foldQuoted(cl,cl.split(''), 0, 0, 0, 10, new Object());
		var tokens = foldQuotes[0].split(/\s+/);
		var unfoldVars = function(key)
		{
			//return key;
			if (key.match(/^\$_/)) {
				if (foldQuotes[1][key.slice(2)]) {
					return foldQuotes[1][key.slice(2)];
				} 
			}
			
			if (key.match(/^\$/)) {
				if (v[key.slice(1)]) {
					return v[key.slice(1)];
				} 
			}
			return key;
		}
		
		var command = tokens.shift();

		var params = new Object();
		var input  = new Array();
		for (var i=0; i < tokens.length; i++) {
			var param = tokens[i].split("=");
			if (param.length == 2) {
				params[unfoldVars(param[0])] = unfoldVars(param[1]);	
			} else {
				input.push(unfoldVars(tokens[i]));
			}
		}
		return [command, input, params];	
	}
	
	/**
	* executes a given command_line
	**/
	this.exec = function(cl)
	{
		cl = cl.replace(/^\s+|\s+$/g,"") //trim whitespace from beginning and end
		var languageSpace = cl.match(/^:.+?\s+/)
		if(languageSpace != null) {
			languageSpace = languageSpace[0];
		} else {
			languageSpace = '';
		}
		cl = cl.slice(languageSpace.length);	
		languageSpace = languageSpace.replace(/\s+$/g,"");
		
		switch (languageSpace) {
			case ":js": 
				return eval(cl);
				break;
			case ":bg":
				var parser = this.parse(cl);
				return this.sendPost(parser[0], parser[1], parser[2]);
			default:
				var parser = this.parse(cl);
				console.log(parser);
				if (c[parser[0]]) {
					return c[parser[0]](parser[0], parser[1], parser[2], this);			
				}
				break;
		}
	}

	this.sendPost = function(cmd, input, params)
	{
		var url = "http://host.local/bsshell/backend.php";

		var postParams = "cmd=" + cmd + "&input=" + input.join(" ");
		for (var param in params) {
			postParams += "&" + param + params[param];
		}
		console.log(postParams);
		http = this.httpObj();
		http.open("POST", url, false );

		//Send the proper header information along with the request
		http.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		//http.setRequestHeader("Content-length", params.length);
		//http.setRequestHeader("Connection", "close");
		/*
		http.onreadystatechange = function() {//Call a function when the state changes.
			if(http.readyState == 4 && http.status == 200) {
				return http.responseText;
				var newDoc = top.frames[1].document.open("text/html", "replace");
				newDoc.write(http.responseText);
				newDoc.close();
				
			}
		}
		*/
		http.send(postParams);
		return http.responseText;
	}

	this.httpObj = function()
	{
	    var xmlhttp = null;
	    // Mozilla
	    if (window.XMLHttpRequest) {
	        xmlhttp = new XMLHttpRequest();
	    }
	    // IE
	    else if (window.ActiveXObject) {
	        xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
	    }
		return xmlhttp;
	}
}

s = new bs_shell();
//alert("shell loaded");