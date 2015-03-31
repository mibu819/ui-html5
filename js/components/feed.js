(function (manywho) {

    var feedInput = React.createClass({

        onClick: function(e) {

            var self = this;

            this.props.send(this.state.text, this.props.messageId, this.state.mentionedUsers)
                .then(function () {

                    self.setState({
                        text: '',
                        mentionedUsers: {},
                        users: [],
                        selectedUser: null,
                        selectedIndex: 0
                    });

                });

        },

        onMentionClick: function(e) {

            this.setState({ 
                selectedUser: e.currentTarget.id
            });

            this.insertMention();
            
        },

        insertMention: function() {

            var state = {
                text: this.state.text.trim().replace(/@[A-Za-z]{2,}$/, '@[' + this.state.users[this.state.selectedIndex].fullName + ']'),
                mentionIsVisible: false,
                mentionedUsers: this.state.mentionedUsers
            }

            var selectedUser = this.state.users[this.state.selectedIndex];
            state.mentionedUsers[selectedUser.id] = selectedUser;
            
            this.setState(state);

        },

        onKeyPress: function(e) {

            e.stopPropagation();

            if (e.charCode == 13 && !e.shiftKey) {

                e.preventDefault();

                if (this.state.mentionIsVisible) {

                    this.insertMention();

                }                
                else {

                    this.props.send(this.state.text, this.props.messageId);

                }

            }

            if (e.charCode == 38 && this.state.mentionIsVisible) {

                e.preventDefault();
                this.setState({ selectedUser: Math.max(this.state.selectedIndex--, 0) });

            }
            else if (e.charCode == 40 && this.state.mentionIsVisible) {

                e.preventDefault();
                this.setState({ selectedUser: Math.min(this.state.selectedIndex++, this.state.users.length) });

            }

        },

        onChange: function(e) {

            this.setState({ text: e.currentTarget.value});

            if (!manywho.utils.isNullOrWhitespace(e.currentTarget.value)) {

                var matches = e.currentTarget.value.trim().match(/@[A-Za-z]{2,}$/, 'ig');
                if (matches && matches.length > 0) {
                    
                    var mention = matches[0].substring(1);
                    var self = this;

                    manywho.social.getUsers(this.props.flowKey, mention)
                        .then(function (response) {

                            self.setState({
                                users: response,
                                selectedUser: null,
                                selectedIndex: 0,
                                mentionIsVisible: true
                            });

                        });

                }
                else {

                    this.setState({ mentionIsVisible: false });

                }

            }
            
        },

        getInitialState: function() {

            return {
                text: '',
                mentionisVisible: false,
                mentionedUsers: {},
                users: [],
                selectedUser: null,
                selectedIndex: 0
            }

        },

        render: function () {

            var mention = React.DOM.ul({ className: 'list-group mentions' }, this.state.users.map(function(user, index) {

                return React.DOM.li({
                    className: 'list-group-item ' + ((index == this.state.selectedIndex) ? 'active' : null),
                    id: index,
                    onClick: this.onMentionClick
                }, user.fullName);

            }, this));

            return React.DOM.div({ className: 'input-group feed-post' }, [
                React.DOM.div({ className: 'input-group-btn feed-post-button' },
                    React.DOM.button({ className: 'btn btn-primary', onClick: this.onClick }, this.props.caption)
                ),
                React.DOM.textarea({ className: 'form-control feed-post-text', rows: '2', onKeyPress: this.onKeyPress, onChange: this.onChange, value: this.state.text }, null),
                (this.state.mentionIsVisible) ? mention : null
            ]);

        }

    });

    var feed = React.createClass({

        onToggleFollow: function(e) {

            manywho.social.toggleFollow(this.props.flowKey);

        },

        onRefresh: function(e) {

            manywho.social.refreshMessages(this.props.flowKey);

        },

        onGetNextPage: function(e) {

            manywho.social.getMessages(this.props.flowKey);

        },

        onSendMessage: function(message, messageId, mentionedUsers) {

            return manywho.social.sendMessage(this.props.flowKey, message, messageId, mentionedUsers);

        },
        
        renderThread: function(messages, isCommentingEnabled) {

            if (messages) {

                return React.DOM.ul({ className: 'media-list' }, messages.map(function (message) {

                    var createdDate = new Date(message.createdDate);

                    return React.DOM.li({ className: 'media' }, [
                        React.DOM.div({ className: 'media-left' },
                            React.DOM.a({ href: '#' },
                                React.DOM.img({ className: 'media-object', src: message.sender.avatarUrl, width: '32', height: '32' }, null)
                            )
                        ),
                        React.DOM.div({ className: 'media-body feed-message' }, [
                            React.DOM.div({ className: 'media-heading' }, [
                                React.DOM.span({ className: 'feed-sender' }, message.sender.fullName),
                                React.DOM.span({ className: 'feed-created-date' }, createdDate.toLocaleString()),
                            ]),
                            React.DOM.div({ className: 'feed-message-text', dangerouslySetInnerHTML: { __html: message.text } }, null),
                            this.renderThread(message.comments, false),
                            isCommentingEnabled && React.createElement(feedInput, { caption: 'Comment', flowKey: this.props.flowKey, messageId: message.id, send: this.onSendMessage }, null)
                        ])
                    ]);

                }, this));

            }

            return null;

        },

        renderFollowers: function(followers) {

            if (followers) {
                
                var followerElements = followers.map(function (follower) {

                    return React.DOM.img({ className: 'feed-follower', src: follower.avatarUrl, title: follower.fullName, width: '32', height: '32' });

                });

                return React.DOM.div({ className: 'feed-followers' }, [ React.DOM.h4(null, 'Followers') ].concat(followerElements));

            }

            return null;

        },
                
        render: function () {

            var stream = manywho.social.getStream(this.props.flowKey);

            if (stream && stream.me) {

                log.info('Rendering Feed');

                var streamMessages = stream.messages || {};
                var loading = manywho.state.getLoading('feed', this.props.flowKey);
                
                var followCaption = (stream.me.isFollower) ? 'Un-Follow' : 'Follow';
                var isFooterVisible = streamMessages.nextPage && streamMessages.nextPage > 1;
                
                return React.DOM.div({ className: 'panel panel-default feed', onKeyUp: this.onEnter }, [
                    React.DOM.div({ className: 'panel-heading clearfix' }, [
                        React.DOM.h3({ className: 'panel-title pull-left' }, 'Feed'),
                        React.DOM.div({ className: 'pull-right btn-group' }, [
                            React.DOM.button({ className: 'btn btn-default btn-sm', onClick: this.onToggleFollow }, [
                                React.DOM.span({ className: 'glyphicon glyphicon-pushpin'}, null),
                                ' ' + followCaption
                            ]),
                            React.DOM.button({ className: 'btn btn-default btn-sm', onClick: this.onRefresh }, [
                                React.DOM.span({ className: 'glyphicon glyphicon-refresh' }, null),
                                ' Refresh'
                            ])
                        ])                        
                    ]),
                    React.DOM.div({ className: 'panel-body' }, [
                        this.renderFollowers(stream.followers),
                        React.createElement(feedInput, { caption: 'Post', flowKey: this.props.flowKey, send: this.onSendMessage }, null),
                        this.renderThread(streamMessages.messages, true)
                    ]),
                    React.DOM.div({ className: 'panel-heading clearfix ' + (!isFooterVisible) ? 'hidden' : '' },
                        React.DOM.button({ className: 'btn btn-default pull-right', onClick: this.onGetNextPage }, 'More')
                    ),
                    React.createElement(manywho.component.getByName('wait'), loading, null)
                ]);
                
            }
            
            return null;

        }

    });

    manywho.component.register("feed", feed);

}(manywho));

