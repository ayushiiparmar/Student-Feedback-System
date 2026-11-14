(function () {
  'use strict';

  const sessionKey = 'sru-feedback-api-session-v1';
  const frontendConfig = window.SRU_FEEDBACK_CONFIG;
  if (!frontendConfig || typeof frontendConfig.apiBaseUrl !== 'string' || !frontendConfig.apiBaseUrl.trim()) {
    throw new Error('Frontend API configuration is missing. Ensure config.js loads before script.js.');
  }
  const apiBaseUrl = frontendConfig.apiBaseUrl.replace(/\/+$/, '');
  const demoAccountsEnabled = frontendConfig.demoAccountsEnabled === true;
  const ratingCategories = [
    { key: 'clarity', label: 'Clarity of Teaching', short: 'Clarity' },
    { key: 'communication', label: 'Communication', short: 'Communication' },
    { key: 'punctuality', label: 'Punctuality', short: 'Punctuality' },
    { key: 'engagement', label: 'Engagement', short: 'Engagement' },
    { key: 'subjectKnowledge', label: 'Subject Knowledge', short: 'Knowledge' }
  ];
  const demoAccounts = demoAccountsEnabled && frontendConfig.demoAccounts
    ? frontendConfig.demoAccounts
    : {};
  const demoPassword = demoAccountsEnabled && typeof frontendConfig.demoPassword === 'string'
    ? frontendConfig.demoPassword
    : '';
  let store = { users: [], courses: [], enrollments: [], feedback: [] };
  let adminAnalytics = null;
  let facultyDashboardData = null;
  const charts = {};

  if (!demoAccountsEnabled) {
    const demoBox = document.querySelector('.demo-box');
    if (demoBox) demoBox.hidden = true;
    document.querySelectorAll('.profile-menu').forEach(function (menu) { menu.hidden = true; });
    document.querySelectorAll('[data-role-menu-toggle]').forEach(function (button) {
      button.disabled = true;
      button.removeAttribute('data-role-menu-toggle');
      button.removeAttribute('aria-haspopup');
      button.removeAttribute('aria-controls');
      button.removeAttribute('aria-expanded');
    });
  }

  function getStoredUser() {
    try {
      const session = JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
      return session && session.user && session.token ? session.user : null;
    } catch (error) {
      console.warn('API session could not be read.', error);
      return null;
    }
  }

  function getStoredToken() {
    try {
      const session = JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
      return session && session.token ? session.token : null;
    } catch (error) {
      console.warn('API token could not be read.', error);
      return null;
    }
  }

  function setStoredUser(user, token) {
    sessionStorage.setItem(sessionKey, JSON.stringify({ user: user, token: token }));
  }

  async function apiRequest(path, options) {
    const requestOptions = Object.assign({ method: 'GET' }, options || {});
    requestOptions.headers = Object.assign(
      { Accept: 'application/json' },
      requestOptions.headers || {}
    );
    if (requestOptions.body !== undefined) {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(requestOptions.body);
    }
    const token = getStoredToken();
    if (token) requestOptions.headers.Authorization = 'Bearer ' + token;

    let response;
    try {
      response = await fetch(apiBaseUrl + path, requestOptions);
    } catch (error) {
      throw new Error('Cannot reach the API. Start the backend and try again.');
    }

    let payload = {};
    try {
      payload = response.status === 204 ? {} : await response.json();
    } catch (error) {
      throw new Error('The API returned an unreadable response.');
    }
    if (!response.ok) {
      if (response.status === 401 && path !== '/auth/login') {
        sessionStorage.removeItem(sessionKey);
      }
      throw new Error(payload.error || 'The request could not be completed.');
    }
    return payload;
  }

  function mapUser(user) {
    const id = String(user._id || user.id || '');
    return {
      id: id,
      role: user.role,
      name: user.name,
      email: user.email,
      department: user.department || '',
      semester: user.semester || '',
      program: user.department || '',
      year: user.semester || '',
      studentId: user.studentId || id.slice(-8),
      employeeId: user.employeeId || id.slice(-8),
      status: 'Active'
    };
  }

  function mapCourse(course) {
    const id = String(course._id || course.id || '');
    const faculty = course.faculty;
    const enrolledStudents = Array.isArray(course.enrolledStudents)
      ? course.enrolledStudents.map(function (student) {
        return String(student._id || student);
      })
      : [];
    return {
      id: id,
      code: course.courseCode || '',
      title: course.courseName || course.title || '',
      department: course.department || '',
      semester: course.semester || '',
      program: course.department || '',
      year: course.semester || '',
      facultyId: faculty && typeof faculty === 'object' ? String(faculty._id) : String(faculty || ''),
      facultyName: faculty && typeof faculty === 'object' ? faculty.name : '',
      facultyEmail: faculty && typeof faculty === 'object' ? faculty.email : '',
      enrolledStudentIds: enrolledStudents,
      enrolledCount: Number(course.enrolledCount) || enrolledStudents.length
    };
  }

  function mapFeedback(entry, studentId) {
    const ratings = Array.isArray(entry.ratings) ? entry.ratings : [
      entry.ratings.clarity,
      entry.ratings.communication,
      entry.ratings.punctuality,
      entry.ratings.engagement,
      entry.ratings.subjectKnowledge
    ];
    return {
      id: String(entry.id || entry._id || ''),
      studentId: studentId || '',
      courseId: String(entry.course && (entry.course.id || entry.course._id) || entry.courseId || ''),
      ratings: ratings.map(Number),
      comment: entry.comments || entry.comment || '',
      submittedAt: entry.submittedAt
    };
  }

  async function loadStudentData() {
    const [profile, courseResult, statusResult, feedbackResult] = await Promise.all([
      apiRequest('/student/profile'),
      apiRequest('/student/courses'),
      apiRequest('/student/feedback/status'),
      apiRequest('/student/feedback')
    ]);
    const user = mapUser(profile.user);
    setStoredUser(user, getStoredToken());
    const statusById = new Map(statusResult.courses.map(function (item) {
      return [String(item.course._id), item];
    }));
    store.users = [user];
    store.courses = courseResult.courses.map(function (courseData) {
      const course = mapCourse(courseData);
      const status = statusById.get(course.id);
      course.submitted = Boolean(status && status.submitted);
      course.submittedAt = status ? status.submittedAt : null;
      if (courseData.faculty) store.users.push(mapUser(courseData.faculty));
      return course;
    });
    store.enrollments = store.courses.map(function (course) {
      return { studentId: user.id, courseId: course.id };
    });
    store.feedback = feedbackResult.feedback.map(function (entry) {
      return mapFeedback(entry, user.id);
    });
    return user;
  }

  async function loadFacultyData() {
    const user = mapUser(getStoredUser());
    setStoredUser(user, getStoredToken());
    const result = await apiRequest('/faculty/courses');
    const courses = result.courses.map(mapCourse);
    const analytics = await Promise.all(courses.map(function (course) {
      return apiRequest('/faculty/courses/' + encodeURIComponent(course.id) + '/analytics');
    }));

    store.users = [mapUser(user)];
    store.courses = courses;
    store.enrollments = [];
    store.feedback = [];
    facultyDashboardData = {
      courses: courses.map(function (course, index) {
        const detail = analytics[index];
        return {
          course: course,
          responseCount: detail.responseCount,
          averageRating: detail.averageRating,
          categoryAverages: detail.categoryAverages,
          commentsAvailable: detail.privacy.commentsAvailable,
          comments: detail.feedbackComments.map(function (item) {
            return {
              comment: item.comment,
              courseId: course.id
            };
          }),
          trend: detail.feedbackTrend
        };
      })
    };
    return mapUser(user);
  }

  async function loadAdminData() {
    const [studentsResult, facultyResult, coursesResult, analytics] = await Promise.all([
      apiRequest('/admin/students'),
      apiRequest('/admin/faculty'),
      apiRequest('/admin/courses'),
      apiRequest('/admin/analytics')
    ]);
    const user = mapUser(getStoredUser());
    setStoredUser(user, getStoredToken());
    store.users = studentsResult.users.map(mapUser).concat(facultyResult.users.map(mapUser), [mapUser(user)]);
    store.courses = coursesResult.courses.map(mapCourse);
    store.enrollments = store.courses.reduce(function (all, course) {
      return all.concat(course.enrolledStudentIds.map(function (studentId) {
        return { studentId: studentId, courseId: course.id };
      }));
    }, []);
    store.feedback = [];
    adminAnalytics = analytics;
    return mapUser(user);
  }

  function routeForRole(role) {
    return role === 'faculty' ? 'faculty.html' : role === 'admin' ? 'admin.html' : 'student.html';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function initials(name) {
    return String(name || '').replace(/^(Dr\.?|Prof\.?|Professor|Mr\.?|Ms\.?|Mrs\.?)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) { return part[0]; }).join('').toUpperCase() || 'SR';
  }

  function average(values) {
    return values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : null;
  }

  function ratingClass(value) {
    return value >= 4.5 ? 'rating-excellent' : value >= 3 ? 'rating-average' : 'rating-needs-improvement';
  }

  function ratingLabel(value) {
    return value >= 4.5 ? 'Excellent' : value >= 3 ? 'Average' : 'Needs Improvement';
  }

  function courseById(id) {
    return store.courses.find(function (course) { return course.id === id; });
  }

  function userById(id) {
    return store.users.find(function (user) { return user.id === id; });
  }

  function showToast(message) {
    const toast = document.getElementById('admin-toast') || document.getElementById('app-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(function () { toast.classList.remove('visible'); }, 3000);
  }

  function showDashboardError(message) {
    const content = document.querySelector('.page-content');
    if (!content) {
      showToast(message);
      return;
    }
    let banner = document.getElementById('api-error-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'api-error-banner';
      banner.className = 'api-error-banner';
      banner.setAttribute('role', 'alert');
      content.insertBefore(banner, content.firstChild);
    }
    banner.textContent = message;
  }

  function setAdminRowsState(message) {
    const rows = [
      { id: 'students-rows', columns: 6 },
      { id: 'faculty-rows', columns: 6 },
      { id: 'courses-rows', columns: 6 },
      { id: 'assignment-rows', columns: 4 }
    ];
    rows.forEach(function (item) {
      const body = document.getElementById(item.id);
      if (body) body.innerHTML = '<tr class="empty-table-message"><td colspan="' + item.columns + '">' + escapeHtml(message) + '</td></tr>';
    });
  }

  function setupLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;
    const message = document.getElementById('login-message');
    const password = document.getElementById('login-password');
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const selectedRole = document.getElementById('login-role').value;
      const submitButton = form.querySelector('[type="submit"]');
      submitButton.disabled = true;
      message.textContent = '';
      try {
        const result = await apiRequest('/auth/login', {
          method: 'POST',
          body: { email: email, password: password.value }
        });
        if (result.user.role !== selectedRole) {
          throw new Error('This account does not have the selected role.');
        }
        setStoredUser(mapUser(result.user), result.token);
        window.location.href = routeForRole(result.user.role);
      } catch (error) {
        message.textContent = error.message;
        message.classList.remove('success');
      } finally {
        submitButton.disabled = false;
      }
    });

    document.querySelectorAll('[data-password-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        const revealing = password.type === 'password';
        password.type = revealing ? 'text' : 'password';
        button.textContent = revealing ? 'Hide' : 'Show';
        button.setAttribute('aria-label', revealing ? 'Hide password' : 'Show password');
      });
    });

    const registerToggle = document.getElementById('register-toggle');
    const registerPanel = document.getElementById('register-panel');
    registerToggle.addEventListener('click', function () {
      registerPanel.hidden = !registerPanel.hidden;
      registerToggle.textContent = registerPanel.hidden ? 'Create an account' : 'Close registration';
      registerToggle.setAttribute('aria-expanded', String(!registerPanel.hidden));
      document.getElementById('register-message').textContent = '';
    });

    document.querySelectorAll('[data-demo-role]').forEach(function (button) {
      button.addEventListener('click', function () {
        if (!demoAccountsEnabled) return;
        const role = button.dataset.demoRole;
        const email = demoAccounts[role];
        if (!email || !demoPassword) return;
        document.getElementById('login-email').value = email;
        document.getElementById('login-role').value = button.dataset.demoRole;
        password.value = demoPassword;
        message.textContent = '';
        form.requestSubmit();
      });
    });

    registerPanel.addEventListener('submit', async function (event) {
      event.preventDefault();
      const formData = new FormData(registerPanel);
      const email = String(formData.get('email')).trim().toLowerCase();
      const passwordValue = String(formData.get('password'));
      const confirmPassword = String(formData.get('confirmPassword'));
      const message = document.getElementById('register-message');
      if (passwordValue.length < 8 || passwordValue !== confirmPassword) {
        message.textContent = passwordValue.length < 8 ? 'Use a password with at least 8 characters.' : 'The passwords do not match.';
        message.classList.remove('success');
        return;
      }
      const program = String(formData.get('program'));
      const department = program.indexOf('Computer Science') !== -1 ? 'Computer Science & Engineering'
        : program.indexOf('Electronics') !== -1 ? 'Electronics'
          : program.indexOf('Information Technology') !== -1 ? 'Information Technology'
            : program.indexOf('Mechanical') !== -1 ? 'Mechanical Engineering' : 'Business';
      const submitButton = registerPanel.querySelector('[type="submit"]');
      submitButton.disabled = true;
      message.textContent = '';
      try {
        const semester = String(formData.get('semester'));
        await apiRequest('/auth/register', {
          method: 'POST',
          body: {
            name: String(formData.get('name')).trim(),
            email: email,
            password: passwordValue,
            department: department,
            semester: semester
          }
        });
        const loginResult = await apiRequest('/auth/login', {
          method: 'POST',
          body: { email: email, password: passwordValue }
        });
        setStoredUser(mapUser(loginResult.user), loginResult.token);
        window.location.href = 'student.html';
      } catch (error) {
        message.textContent = error.message;
        message.classList.remove('success');
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  function setupCommon() {
    document.querySelectorAll('[data-logout]').forEach(function (button) {
      button.addEventListener('click', function () {
        sessionStorage.removeItem(sessionKey);
        window.location.href = 'index.html';
      });
    });
    document.querySelectorAll('[data-menu-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        document.getElementById('sidebar').classList.toggle('open');
      });
    });
    document.addEventListener('click', function (event) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(event.target) && !event.target.closest('[data-menu-toggle]')) {
        sidebar.classList.remove('open');
      }

      const menuToggle = event.target.closest('[data-role-menu-toggle]');
      if (menuToggle) {
        const menu = document.getElementById(menuToggle.getAttribute('aria-controls'));
        const willOpen = menu.hidden;
        document.querySelectorAll('.profile-menu').forEach(function (item) { item.hidden = true; });
        document.querySelectorAll('[data-role-menu-toggle]').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
        menu.hidden = !willOpen;
        menuToggle.setAttribute('aria-expanded', String(willOpen));
        return;
      }

      if (event.target.closest('.profile-menu')) return;
      document.querySelectorAll('.profile-menu').forEach(function (menu) { menu.hidden = true; });
      document.querySelectorAll('[data-role-menu-toggle]').forEach(function (button) { button.setAttribute('aria-expanded', 'false'); });
    });
    document.addEventListener('click', async function (event) {
      const roleButton = event.target.closest('[data-switch-role]');
      if (!roleButton) return;
      if (!demoAccountsEnabled || !demoPassword) return;
      const role = roleButton.dataset.switchRole;
      const email = demoAccounts[role];
      if (!email) return;
      roleButton.disabled = true;
      try {
        const result = await apiRequest('/auth/login', {
          method: 'POST',
          body: { email: email, password: demoPassword }
        });
        if (result.user.role !== role) throw new Error('The demo account role did not match.');
        setStoredUser(mapUser(result.user), result.token);
        window.location.href = routeForRole(role);
      } catch (error) {
        showToast(error.message);
      } finally {
        roleButton.disabled = false;
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.profile-menu').forEach(function (menu) { menu.hidden = true; });
      document.querySelectorAll('[data-role-menu-toggle]').forEach(function (button) {
        button.setAttribute('aria-expanded', 'false');
        if (button === document.activeElement) button.focus();
      });
    });
  }

  function setStudentView(view) {
    const historyPanel = document.getElementById('student-history');
    const coursesPanel = document.getElementById('student-courses');
    const heading = document.getElementById('student-breadcrumb');
    const courseTitle = document.getElementById('courses-title');
    const subtitle = document.getElementById('courses-subtitle');
    const activeView = ['overview', 'courses', 'history'].indexOf(view) === -1 ? 'overview' : view;
    const isHistory = activeView === 'history';
    const isCourses = activeView === 'courses';
    historyPanel.hidden = !isHistory;
    coursesPanel.hidden = isHistory;
    document.getElementById('student-heading').hidden = isHistory || isCourses;
    document.querySelector('.student-stats').hidden = isHistory || isCourses;
    document.querySelector('.student-profile-grid').hidden = isHistory || isCourses;
    heading.textContent = isHistory ? 'Feedback history' : isCourses ? 'My courses' : 'Overview';
    courseTitle.textContent = isCourses ? 'All enrolled courses' : 'Your courses';
    subtitle.textContent = isCourses ? 'Review your course details and feedback status' : 'Feedback status for your enrolled courses';
    document.querySelectorAll('[data-student-view]').forEach(function (link) {
      link.classList.toggle('active', link.dataset.studentView === activeView);
    });
  }

  function renderStudentCourses() {
    const body = document.getElementById('student-course-rows');
    const student = getStoredUser();
    const enrollments = student ? store.enrollments.filter(function (item) { return item.studentId === student.id; }) : [];
    const enrolledCourses = enrollments.map(function (item) { return courseById(item.courseId); }).filter(Boolean);
    body.innerHTML = enrolledCourses.length ? '' : '<tr class="empty-table-message"><td colspan="5"><div class="empty-state"><span class="empty-icon">▤</span><strong>No courses assigned yet</strong><p>Your courses will appear here after an administrator enrolls you.</p></div></td></tr>';
    enrolledCourses.forEach(function (course) {
      const submitted = store.feedback.some(function (entry) { return entry.studentId === student.id && entry.courseId === course.id; });
      const faculty = userById(course.facultyId);
      const row = document.createElement('tr');
      row.innerHTML =
        '<td><div class="course-cell"><span class="course-code">' + escapeHtml((course.code || course.id).slice(0, 3)) + '</span><span><strong>' + escapeHtml(course.title) + '</strong><small>' + escapeHtml((course.code || course.id) + ' · ' + course.semester) + '</small></span></div></td>' +
        '<td>' + escapeHtml(faculty ? faculty.name : 'Not assigned') + '</td><td>' + escapeHtml(course.department) + '</td>' +
        '<td><span class="status-badge ' + (submitted ? 'status-complete' : 'status-pending') + '">' + (submitted ? 'Submitted' : 'Pending') + '</span></td>' +
        '<td>' + (submitted ? '<button class="button button-quiet table-action" type="button" disabled aria-label="Feedback submitted for ' + escapeHtml(course.title) + '">Submitted ✓</button>' : faculty ? '<button class="button button-primary table-action" type="button" data-feedback-course="' + escapeHtml(course.id) + '">Give feedback</button>' : '<span class="status-badge status-pending">Faculty not assigned</span>') + '</td>';
      body.appendChild(row);
    });
    const submittedCount = student ? store.feedback.filter(function (entry) { return entry.studentId === student.id && enrolledCourses.some(function (course) { return course.id === entry.courseId; }); }).length : 0;
    document.getElementById('student-course-count').textContent = String(enrolledCourses.length);
    document.getElementById('student-department-count').textContent = enrolledCourses.length ? 'Across ' + new Set(enrolledCourses.map(function (course) { return course.department; })).size + ' departments' : 'No courses assigned yet';
    document.getElementById('completed-count').innerHTML = submittedCount + ' <span class="stat-denominator">/ ' + enrolledCourses.length + '</span>';
    document.getElementById('pending-count').textContent = String(Math.max(0, enrolledCourses.length - submittedCount));
    const pendingLabel = document.querySelector('.student-stats .trend-warm');
    if (pendingLabel) pendingLabel.textContent = Math.max(0, enrolledCourses.length - submittedCount) + ' pending';
    renderHistory();
  }

  function renderHistory() {
    const list = document.getElementById('student-history-list');
    const student = getStoredUser();
    const submitted = student ? store.feedback.filter(function (entry) { return entry.studentId === student.id; }) : [];
    if (!submitted.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-icon">◷</span><strong>No feedback submitted yet</strong><p>Your completed evaluations will appear here.</p><button class="button button-secondary" type="button" data-student-view="courses">Browse your courses</button></div>';
      return;
    }
    list.innerHTML = submitted.map(function (entry) {
      const course = courseById(entry.courseId);
      if (!course) return '';
      const score = average(entry.ratings);
      const ratings = entry.ratings.map(function (rating, index) {
        return '<div class="history-rating-item"><span>' + escapeHtml(ratingCategories[index].short) + '</span><strong>' + escapeHtml(rating) + ' / 5</strong></div>';
      }).join('');
      const comment = entry.comment
        ? '<p class="history-comment"><strong>Optional comment</strong>' + escapeHtml(entry.comment) + '</p>'
        : '';
      return '<article class="history-item history-entry"><div class="history-entry-heading"><div><strong>' + escapeHtml(course.title) + '</strong><span>' + escapeHtml(course.code || course.id) + ' · Submitted ' + new Date(entry.submittedAt).toLocaleDateString() + ' · Read-only</span></div><span class="history-rating ' + (score === null ? 'status-complete' : ratingClass(score)) + '">' + (score === null ? 'Submitted' : score.toFixed(1) + ' / 5') + '</span></div><div class="history-ratings">' + ratings + '</div>' + comment + '</article>';
    }).join('');
  }

  function openFeedback(courseId) {
    const course = courseById(courseId);
    const student = getStoredUser();
    const enrolled = store.enrollments.some(function (item) { return item.studentId === student.id && item.courseId === courseId; });
    const alreadySubmitted = store.feedback.some(function (entry) { return entry.studentId === student.id && entry.courseId === courseId; });
    if (!course || !enrolled || alreadySubmitted) return;
    const faculty = userById(course.facultyId);
    if (!faculty) return;
    const modal = document.getElementById('feedback-modal');
    document.getElementById('feedback-course-name').textContent = course.title + ' · ' + (course.code || course.id) + ' · ' + faculty.name;
    document.getElementById('feedback-message').textContent = '';
    document.getElementById('feedback-comment').value = '';
    document.getElementById('rating-fields').innerHTML = ratingCategories.map(function (category, index) {
      const options = [1, 2, 3, 4, 5].map(function (value) {
        return '<label class="rating-option"><input type="radio" name="rating-' + index + '" value="' + value + '" required><span>' + value + '</span></label>';
      }).join('');
      return '<div class="rating-field"><strong>' + escapeHtml(category.label) + '</strong><div class="rating-options" role="radiogroup" aria-label="' + escapeHtml(category.label) + '">' + options + '</div></div>';
    }).join('');
    modal.dataset.courseId = course.id;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('input[type="radio"]').focus();
  }

  function closeFeedback() {
    const modal = document.getElementById('feedback-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  async function setupStudent() {
    if (!document.getElementById('student-course-rows')) return;
    const demoUser = getStoredUser();
    if (!demoUser || demoUser.role !== 'student') {
      window.location.href = demoUser ? routeForRole(demoUser.role) : 'index.html';
      return;
    }
    try {
      await loadStudentData();
      renderProfile(getStoredUser());
      renderStudentCourses();
    } catch (error) {
      showDashboardError(error.message);
    }
    const profileDetailsToggle = document.querySelector('[data-profile-details-toggle]');
    profileDetailsToggle.addEventListener('click', function () {
      const extraDetails = document.getElementById('student-profile-extra');
      const expanded = extraDetails.hidden;
      extraDetails.hidden = !expanded;
      profileDetailsToggle.setAttribute('aria-expanded', String(expanded));
      profileDetailsToggle.setAttribute('aria-label', expanded ? 'Hide additional profile details' : 'More profile details');
    });
    document.addEventListener('click', function (event) {
      const feedbackButton = event.target.closest('[data-feedback-course]');
      if (feedbackButton) openFeedback(feedbackButton.dataset.feedbackCourse);
      const viewButton = event.target.closest('[data-student-view]');
      if (viewButton) {
        event.preventDefault();
        setStudentView(viewButton.dataset.studentView);
        document.getElementById('sidebar').classList.remove('open');
        window.location.hash = viewButton.dataset.studentView === 'history' ? 'feedback-history' : viewButton.dataset.studentView === 'courses' ? 'my-courses' : 'overview';
      }
    });
    document.querySelectorAll('[data-close-feedback]').forEach(function (button) { button.addEventListener('click', closeFeedback); });
    document.getElementById('feedback-modal').addEventListener('click', function (event) {
      if (event.target.id === 'feedback-modal') closeFeedback();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeFeedback();
    });
    document.getElementById('feedback-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      const modal = document.getElementById('feedback-modal');
      const courseId = modal.dataset.courseId;
      const selections = ratingCategories.map(function (_, index) {
        const selected = document.querySelector('input[name="rating-' + index + '"]:checked');
        return selected ? Number(selected.value) : null;
      });
      const message = document.getElementById('feedback-message');
      if (selections.some(function (value) { return !Number.isInteger(value) || value < 1 || value > 5; })) {
        message.classList.remove('success');
        message.textContent = 'Please rate all five teaching parameters with a whole-number score from 1 to 5.';
        return;
      }
      const student = getStoredUser();
      const course = courseById(courseId);
      const duplicate = store.feedback.some(function (entry) { return entry.studentId === student.id && entry.courseId === courseId; });
      const enrolled = store.enrollments.some(function (item) { return item.studentId === student.id && item.courseId === courseId; });
      if (duplicate || !enrolled || !course) {
        message.classList.remove('success');
        message.textContent = duplicate ? 'Feedback has already been submitted for this course.' : 'This course is no longer available for feedback.';
        return;
      }
      const submitButton = document.querySelector('#feedback-form [type="submit"]');
      submitButton.disabled = true;
      try {
        const ratingValues = {};
        ratingCategories.forEach(function (category, index) {
          ratingValues[category.key] = selections[index];
        });
        const result = await apiRequest('/student/feedback', {
          method: 'POST',
          body: {
            courseId: courseId,
            ratings: ratingValues,
            comments: document.getElementById('feedback-comment').value.trim()
          }
        });
        message.classList.add('success');
        message.textContent = result.message || 'Thank you! Your feedback has been submitted.';
        await loadStudentData();
        renderStudentCourses();
        const modalClose = document.querySelector('[data-close-feedback]');
        if (modalClose) modalClose.focus();
        window.setTimeout(closeFeedback, 1100);
      } catch (error) {
        message.classList.remove('success');
        message.textContent = error.message;
      } finally {
        submitButton.disabled = false;
      }
    });
    const initialView = window.location.hash === '#feedback-history' ? 'history' : window.location.hash === '#my-courses' ? 'courses' : 'overview';
    setStudentView(initialView);
    window.addEventListener('hashchange', function () {
      const view = window.location.hash === '#feedback-history' ? 'history' : window.location.hash === '#my-courses' ? 'courses' : 'overview';
      setStudentView(view);
    });
  }

  const chartColors = { blue: '#4d85d5', blueFill: 'rgba(77, 133, 213, .15)', green: '#45a87c', grid: '#edf1f5', text: '#8491a2', amber: '#d8a342', red: '#d85f5b' };

  function chartOptions(horizontal, max) {
    const scaleMax = max || 5;
    const stepSize = scaleMax > 10 ? Math.ceil(scaleMax / 5) : 1;
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1b3457', padding: 10, titleFont: { family: 'DM Sans', size: 11 }, bodyFont: { family: 'DM Sans', size: 10 } } },
      scales: horizontal ? {
        x: { min: 0, max: scaleMax, grid: { color: chartColors.grid }, border: { display: false }, ticks: { stepSize: stepSize, color: chartColors.text, font: { family: 'DM Sans', size: 9 } } },
        y: { grid: { display: false }, border: { display: false }, ticks: { color: chartColors.text, font: { family: 'DM Sans', size: 9 } } }
      } : {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: chartColors.text, font: { family: 'DM Sans', size: 9 }, maxRotation: 25, minRotation: 0 } },
        y: { min: 0, max: scaleMax, ticks: { stepSize: stepSize, color: chartColors.text, font: { family: 'DM Sans', size: 9 }, padding: 8 }, grid: { color: chartColors.grid, drawTicks: false }, border: { display: false } }
      }
    };
  }

  function makeChart(id, type, labels, values, horizontal, options) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (charts[id]) {
      charts[id].destroy();
      delete charts[id];
    }
    const parent = canvas.parentElement;
    const oldEmpty = parent.querySelector('.chart-empty-state');
    if (oldEmpty) oldEmpty.remove();
    if (typeof Chart === 'undefined') {
      const error = document.createElement('p');
      error.className = 'chart-empty-state';
      error.textContent = 'Charts could not load. Check your internet connection and reload.';
      parent.appendChild(error);
      return;
    }
    const hasValues = values.some(function (value) { return typeof value === 'number' && Number.isFinite(value); });
    if (!hasValues) {
      const empty = document.createElement('p');
      empty.className = 'chart-empty-state';
      empty.textContent = 'No feedback data yet.';
      parent.appendChild(empty);
    }
    const chartSettings = Object.assign({}, options || {});
    const scaleMax = chartSettings.max;
    const barColors = chartSettings.barColors;
    delete chartSettings.max;
    delete chartSettings.barColors;
    const dataset = type === 'bar'
      ? { data: values, backgroundColor: barColors || values.map(function (value) { return typeof value !== 'number' ? '#dfe6ef' : value >= 4.5 ? chartColors.green : value >= 3 ? chartColors.amber : chartColors.red; }), borderRadius: 5, borderSkipped: false, barThickness: 'flex', maxBarThickness: 26 }
      : { data: values, borderColor: chartColors.blue, backgroundColor: chartColors.blueFill, fill: true, tension: .38, pointRadius: 3, pointBackgroundColor: '#fff', pointBorderColor: chartColors.blue, pointBorderWidth: 2, spanGaps: false };
    charts[id] = new Chart(canvas, {
      type: type,
      data: { labels: labels, datasets: [dataset] },
      options: Object.assign(chartOptions(horizontal, scaleMax), chartSettings)
    });
  }

  function topFaculty() {
    return adminAnalytics ? adminAnalytics.topFaculty.map(function (item) {
      return {
        user: { name: item.name, department: item.department },
        average: item.averageRating,
        responses: item.responseCount
      };
    }) : [];
  }

  function rankingMarkup(ranking) {
    if (!ranking.length) return '<div class="empty-state"><strong>No faculty ratings yet</strong><p>Rankings appear after feedback is submitted.</p></div>';
    return ranking.map(function (item, index) {
      const palette = ['avatar-green', 'avatar-blue', 'avatar-peach', 'avatar-violet', 'avatar-gold'][index % 5];
      return '<div class="ranking-item"><span class="rank-number">' + (index + 1) + '</span><div class="ranking-person"><span class="avatar ' + palette + '">' + escapeHtml(initials(item.user.name)) + '</span><span><strong>' + escapeHtml(item.user.name) + '</strong><small>' + escapeHtml(item.user.department) + '</small></span></div><span class="ranking-score ' + ratingClass(item.average) + '">' + item.average.toFixed(2) + '<small>' + item.responses + ' responses</small></span></div>';
    }).join('');
  }

  function renderFacultyDashboard() {
    const faculty = getStoredUser();
    if (!faculty) return;
    renderProfile(faculty);
    const courseData = facultyDashboardData ? facultyDashboardData.courses : [];
    const responseCount = courseData.reduce(function (sum, item) { return sum + item.responseCount; }, 0);
    const enrollmentCount = courseData.reduce(function (sum, item) { return sum + item.course.enrolledCount; }, 0);
    document.getElementById('faculty-trend-summary').textContent = responseCount
      ? responseCount + ' feedback response' + (responseCount === 1 ? '' : 's')
      : 'No feedback responses yet';
    document.getElementById('faculty-trend-detail').textContent = enrollmentCount
      ? responseCount + ' of ' + enrollmentCount + ' enrolled students have responded across your courses.'
      : 'No students are enrolled in your assigned courses yet.';
    const weightedAverage = courseData.reduce(function (sum, item) {
      return sum + (item.averageRating || 0) * item.responseCount;
    }, 0);
    const overallRating = responseCount ? weightedAverage / responseCount : null;
    const categoryAverages = {};
    ratingCategories.forEach(function (category) {
      const available = courseData.filter(function (item) {
        return item.categoryAverages[category.key] !== null && item.categoryAverages[category.key] !== undefined;
      });
      const categoryResponses = available.reduce(function (sum, item) { return sum + item.responseCount; }, 0);
      categoryAverages[category.key] = categoryResponses
        ? available.reduce(function (sum, item) {
          return sum + item.categoryAverages[category.key] * item.responseCount;
        }, 0) / categoryResponses
        : null;
    });
    document.querySelector('[data-faculty-heading]').textContent = faculty.name;
    document.getElementById('faculty-total-feedback').textContent = String(responseCount);
    document.getElementById('faculty-average-rating').innerHTML = (overallRating === null ? '—' : overallRating.toFixed(2)) + '<span class="stat-denominator"> / 5</span>';
    document.getElementById('faculty-rating-caption').innerHTML = overallRating === null ? 'No feedback yet' : '<span class="rating-indicator ' + ratingClass(overallRating) + '"></span>' + ratingLabel(overallRating);
    document.getElementById('faculty-course-count').textContent = String(courseData.length);
    document.getElementById('faculty-program-count').textContent = courseData.length
      ? 'Across ' + new Set(courseData.map(function (item) { return item.course.department; })).size + ' departments'
      : 'No courses assigned';
    document.getElementById('faculty-response-rate').textContent = enrollmentCount
      ? Math.round(responseCount / enrollmentCount * 100) + '%'
      : '—';

    const rows = document.getElementById('faculty-course-rows');
    rows.innerHTML = courseData.length ? courseData.map(function (item) {
      const course = item.course;
      const score = item.averageRating;
      const badge = score === null ? 'No feedback' : ratingLabel(score);
      const css = score === null ? 'status-pending' : ratingClass(score).replace('rating-', 'status-');
      return '<tr><td><div class="course-cell"><span class="course-code">' + escapeHtml((course.code || course.id).slice(0, 3)) + '</span><span><strong>' + escapeHtml(course.title) + '</strong><small>' + escapeHtml((course.code || course.id) + ' · ' + course.semester) + '</small></span></div></td><td>' + escapeHtml(course.department) + '</td><td>' + item.responseCount + '</td><td>' + (score === null ? '—' : '<span class="rating-value ' + ratingClass(score) + '">' + score.toFixed(2) + '</span> / 5') + '</td><td><span class="status-badge ' + css + '">' + badge + '</span></td></tr>';
    }).join('') : '<tr class="empty-table-message"><td colspan="5"><div class="empty-state"><strong>No courses assigned</strong><p>Ask an administrator to assign a course to your faculty account.</p></div></td></tr>';

    const categoryValues = ratingCategories.map(function (category) { return categoryAverages[category.key]; });
    makeChart('faculty-category-chart', 'bar', ratingCategories.map(function (category) { return category.short; }), categoryValues, false);
    document.getElementById('faculty-category-summary').innerHTML = ratingCategories.map(function (category, index) {
      const score = categoryValues[index];
      return '<div class="category-score"><span>' + escapeHtml(category.label) + '</span><strong class="' + (score === null ? '' : ratingClass(score)) + '">' + (score === null ? '—' : score.toFixed(2)) + '</strong></div>';
    }).join('');

    const comments = courseData.reduce(function (all, item) {
      return all.concat(item.comments.map(function (comment) {
        return Object.assign({ courseTitle: item.course.title }, comment);
      }));
    }, []);
    document.getElementById('faculty-comment-list').innerHTML = comments.length ? comments.map(function (entry) {
      return '<article class="comment-card"><p>“' + escapeHtml(entry.comment) + '”</p><div class="comment-meta"><span class="comment-course">' + escapeHtml(entry.courseTitle) + '</span></div></article>';
    }).join('') : '<div class="empty-state"><strong>' + (courseData.some(function (item) { return item.responseCount > 0; }) ? 'Comments hidden for privacy' : 'No comments yet') + '</strong><p>Comments appear only after at least five responses and five non-empty comments are available for a course.</p></div>';

    const trend = courseData.reduce(function (all, item) {
      return all.concat(item.trend);
    }, []).sort(function (first, second) {
      return first.period.localeCompare(second.period);
    });
    makeChart(
      'faculty-trend-chart',
      'line',
      trend.map(function (item) { return item.period; }),
      trend.map(function (item) { return item.averageRating; }),
      false
    );
    document.getElementById('faculty-trend-detail').textContent = trend.length
      ? 'Monthly averages are shown only for periods with at least five responses.'
      : 'Monthly trend data is hidden until a period has at least five responses.';
  }

  function renderAdminCharts() {
    const parameterAverages = adminAnalytics
      ? ratingCategories.map(function (category) { return adminAnalytics.parameterAverages[category.key]; })
      : [];
    makeChart('admin-parameter-chart', 'bar', ratingCategories.map(function (category) { return category.short; }), parameterAverages, false);
    makeChart('report-parameter-chart', 'bar', ratingCategories.map(function (category) { return category.label; }), parameterAverages, false);
    const departments = adminAnalytics ? adminAnalytics.departmentPerformance : [];
    makeChart('admin-department-chart', 'bar', departments.map(function (item) { return item.department; }), departments.map(function (item) { return item.averageRating; }), true);
    makeChart('report-department-chart', 'bar', departments.map(function (item) { return item.department; }), departments.map(function (item) { return item.averageRating; }), true);
    const courses = adminAnalytics ? adminAnalytics.coursePerformance : [];
    makeChart('admin-course-chart', 'bar', courses.map(function (item) { return item.courseCode; }), courses.map(function (item) { return item.averageRating; }), true);
    makeChart('report-course-chart', 'bar', courses.map(function (item) { return item.courseCode; }), courses.map(function (item) { return item.averageRating; }), true);
    const distribution = adminAnalytics && adminAnalytics.ratingDistribution;
    const distributionRows = distribution && distribution.overall ? distribution.overall : [];
    const distributionValues = distribution && distribution.totalRatings
      ? distributionRows.map(function (item) { return item.count; })
      : [null, null, null, null, null];
    const distributionMax = Math.max.apply(Math, distributionValues.map(function (value) {
      return typeof value === 'number' ? value : 0;
    }));
    makeChart(
      'report-rating-distribution-chart',
      'bar',
      distributionRows.map(function (item) { return item.rating + (item.rating === 1 ? ' star' : ' stars'); }),
      distributionValues,
      false,
      {
        max: distributionMax > 0 ? Math.ceil(distributionMax / 5) * 5 : 5,
        barColors: [chartColors.red, chartColors.red, chartColors.amber, chartColors.amber, chartColors.green]
      }
    );
    const ranking = rankingMarkup(topFaculty());
    document.querySelectorAll('#top-faculty-list, #report-faculty-list').forEach(function (list) { list.innerHTML = ranking; });
  }

  function renderProfile(user) {
    if (!user) return;
    document.querySelectorAll('[data-profile-name]').forEach(function (element) { element.textContent = user.name; });
    document.querySelectorAll('[data-profile-initials]').forEach(function (element) { element.textContent = initials(user.name); });
    if (user.role === 'student') {
      document.querySelector('[data-student-first-name]').textContent = user.name.split(/\s+/)[0];
      document.querySelector('[data-current-date]').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
      document.querySelector('[data-student-id]').textContent = user.studentId || user.id.slice(-8);
      document.querySelector('[data-student-program]').textContent = user.program || 'Program not set';
      document.querySelector('[data-student-year]').textContent = (user.year || 'Year not set') + (user.section ? ' · ' + user.section : '');
      document.querySelector('[data-student-department]').textContent = user.department || 'Department not set';
      document.querySelector('[data-student-email]').textContent = user.email || 'Email not set';
    }
  }

  function actionButtons(type, id) {
    return '<div class="admin-row-actions"><button type="button" data-edit-record="' + escapeHtml(type) + '" data-record-id="' + escapeHtml(id) + '">Edit</button><button type="button" class="delete-record" data-delete-record="' + escapeHtml(type) + '" data-record-id="' + escapeHtml(id) + '">Remove</button></div>';
  }

  function renderAdminTables() {
    const students = store.users.filter(function (user) { return user.role === 'student'; });
    const faculty = store.users.filter(function (user) { return user.role === 'faculty'; });
    document.getElementById('students-rows').innerHTML = students.length ? students.map(function (user) {
      return '<tr><td><div class="person-cell"><span class="avatar avatar-blue">' + escapeHtml(initials(user.name)) + '</span><span><strong>' + escapeHtml(user.name) + '</strong><small>' + escapeHtml(user.email) + '</small></span></div></td><td>' + escapeHtml(user.studentId || '—') + '</td><td>' + escapeHtml(user.department || '—') + '</td><td>' + escapeHtml(user.semester || '—') + '</td><td><span class="status-badge status-complete">' + escapeHtml(user.status || 'Active') + '</span></td><td>' + actionButtons('student', user.id) + '</td></tr>';
    }).join('') : '<tr class="empty-table-message"><td colspan="6"><div class="empty-state"><strong>No students yet</strong><p>Add a student or use student registration.</p></div></td></tr>';
    document.getElementById('faculty-rows').innerHTML = faculty.length ? faculty.map(function (user) {
      const courseCount = store.courses.filter(function (course) { return course.facultyId === user.id; }).length;
      return '<tr><td><div class="person-cell"><span class="avatar avatar-green">' + escapeHtml(initials(user.name)) + '</span><span><strong>' + escapeHtml(user.name) + '</strong><small>' + escapeHtml(user.email) + '</small></span></div></td><td>' + escapeHtml(user.employeeId || '—') + '</td><td>' + escapeHtml(user.department || '—') + '</td><td>' + courseCount + '</td><td><span class="status-badge status-complete">' + escapeHtml(user.status || 'Active') + '</span></td><td>' + actionButtons('faculty', user.id) + '</td></tr>';
    }).join('') : '<tr class="empty-table-message"><td colspan="6"><div class="empty-state"><strong>No faculty yet</strong><p>Add a faculty member to create course assignments.</p></div></td></tr>';
    document.getElementById('courses-rows').innerHTML = store.courses.length ? store.courses.map(function (course) {
      const instructor = userById(course.facultyId);
      return '<tr><td><strong>' + escapeHtml(course.title) + '</strong><small class="table-subtext">' + escapeHtml(course.semester) + '</small></td><td>' + escapeHtml(course.code || course.id) + '</td><td>' + escapeHtml(course.department) + '</td><td>' + escapeHtml(course.facultyName || (instructor ? instructor.name : 'Not assigned')) + '</td><td><span class="status-badge status-complete">Active</span></td><td>' + actionButtons('course', course.id) + '</td></tr>';
    }).join('') : '<tr class="empty-table-message"><td colspan="6"><div class="empty-state"><strong>No courses yet</strong><p>Add a course to start assigning faculty and students.</p></div></td></tr>';
    document.getElementById('students-count-pill').textContent = students.length + ' students';
    document.getElementById('faculty-count-pill').textContent = faculty.length + ' faculty';
    document.getElementById('courses-count-pill').textContent = store.courses.length + ' courses';
  }

  function setSelectOptions(select, placeholder, options, valueFn, labelFn) {
    if (!select) return;
    const selected = select.value;
    select.innerHTML = '<option value="">' + escapeHtml(placeholder) + '</option>' + options.map(function (item) {
      return '<option value="' + escapeHtml(valueFn(item)) + '">' + escapeHtml(labelFn(item)) + '</option>';
    }).join('');
    if (options.some(function (item) { return valueFn(item) === selected; })) select.value = selected;
  }

  function renderAssignments() {
    const students = store.users.filter(function (user) { return user.role === 'student'; });
    const faculty = store.users.filter(function (user) { return user.role === 'faculty'; });
    setSelectOptions(document.getElementById('assignment-faculty'), 'Select faculty member', faculty, function (user) { return user.id; }, function (user) { return user.name + ' · ' + user.department; });
    setSelectOptions(document.getElementById('assignment-faculty-course'), 'Select course', store.courses, function (course) { return course.id; }, function (course) { return course.title + ' (' + (course.code || course.id) + ')'; });
    setSelectOptions(document.getElementById('assignment-student'), 'Select student', students, function (user) { return user.id; }, function (user) { return user.name + ' (' + user.studentId + ')'; });
    setSelectOptions(document.getElementById('assignment-student-course'), 'Select course', store.courses, function (course) { return course.id; }, function (course) { return course.title + ' (' + (course.code || course.id) + ')'; });
    const rows = document.getElementById('assignment-rows');
    rows.innerHTML = store.courses.length ? store.courses.map(function (course) {
      const instructor = userById(course.facultyId);
      const enrollmentCount = store.enrollments.filter(function (item) { return item.courseId === course.id; }).length;
      return '<tr><td><strong>' + escapeHtml(course.title) + '</strong><small class="table-subtext">' + escapeHtml(course.code || course.id) + '</small></td><td>' + escapeHtml(course.facultyName || (instructor ? instructor.name : 'Not assigned')) + '</td><td>' + enrollmentCount + '</td><td>' + escapeHtml(course.semester) + '</td></tr>';
    }).join('') : '<tr class="empty-table-message"><td colspan="4">No courses are available for assignment.</td></tr>';
  }

  function renderAdminMetrics() {
    const totals = adminAnalytics ? adminAnalytics.totals : { students: 0, faculty: 0, courses: 0, feedbackSubmissions: 0 };
    const departments = adminAnalytics ? adminAnalytics.departmentPerformance : [];
    const overall = adminAnalytics ? adminAnalytics.overallAverage : null;
    const departmentMetrics = departments.filter(function (item) { return item.averageRating !== null; }).sort(function (a, b) { return b.averageRating - a.averageRating; });
    const enrollmentCount = store.enrollments.length;
    const feedbackCount = totals.feedbackSubmissions;
    const participation = enrollmentCount ? Math.round(feedbackCount / enrollmentCount * 100) : 0;
    document.getElementById('admin-student-count').textContent = String(totals.students);
    document.getElementById('admin-faculty-count').textContent = String(totals.faculty);
    document.getElementById('admin-course-count').textContent = String(totals.courses);
    document.getElementById('admin-feedback-count').textContent = String(feedbackCount);
    document.getElementById('admin-department-count').textContent = 'Across ' + departments.length + ' departments';
    document.getElementById('admin-participation').textContent = participation + '% participation';
    document.getElementById('admin-overall-average').innerHTML = (overall === null ? '—' : overall.toFixed(2)) + '<span class="stat-denominator"> / 5</span>';
    document.getElementById('admin-overall-caption').innerHTML = overall === null ? 'No feedback yet' : '<span class="rating-indicator ' + ratingClass(overall) + '"></span>' + ratingLabel(overall);
    document.getElementById('admin-feedback-participation').textContent = participation + '%';
    document.getElementById('admin-participation-count').textContent = feedbackCount + ' of ' + enrollmentCount + ' enrollments';
    document.getElementById('admin-highest-department').textContent = departmentMetrics.length ? departmentMetrics[0].department : 'Department';
    document.getElementById('admin-highest-average').textContent = departmentMetrics.length ? departmentMetrics[0].averageRating.toFixed(2) : '—';
    document.getElementById('admin-highest-name').textContent = departmentMetrics.length ? departmentMetrics[0].responseCount + ' feedback responses' : 'No ratings yet';
  }

  function renderAdmin() {
    renderAdminTables();
    renderAssignments();
    renderAdminMetrics();
    renderAdminCharts();
    document.querySelectorAll('[data-table-search]').forEach(applyTableSearch);
  }

  function applyTableSearch(input) {
    const table = document.getElementById(input.dataset.tableSearch + '-table');
    if (!table) return;
    const body = table.querySelector('tbody');
    const query = input.value.toLowerCase();
    const rows = Array.from(body.querySelectorAll('tr:not([data-search-empty])'));
    let visibleCount = 0;
    rows.forEach(function (row) {
      row.hidden = !row.textContent.toLowerCase().includes(query);
      if (!row.hidden) visibleCount += 1;
    });
    let emptyRow = body.querySelector('[data-search-empty]');
    if (!emptyRow) {
      emptyRow = document.createElement('tr');
      emptyRow.dataset.searchEmpty = 'true';
      emptyRow.className = 'empty-table-message';
      emptyRow.innerHTML = '<td colspan="6">No matching records found.</td>';
      body.appendChild(emptyRow);
    }
    emptyRow.hidden = visibleCount > 0;
  }

  let activeRecord = null;

  function recordField(label, name, value, type, required, extra) {
    const id = 'record-field-' + name;
    return '<label for="' + id + '">' + escapeHtml(label) + '</label><input id="' + id + '" name="' + escapeHtml(name) + '" type="' + (type || 'text') + '" value="' + escapeHtml(value) + '"' + (required ? ' required' : '') + (extra || '') + '>';
  }

  function recordSelect(label, name, selected, options, required) {
    const id = 'record-field-' + name;
    const isRequired = required === undefined ? name !== 'facultyId' : required;
    return '<label for="' + id + '">' + escapeHtml(label) + '</label><select id="' + id + '" name="' + escapeHtml(name) + '"' + (isRequired ? ' required' : '') + '>' + options.map(function (item) {
      return '<option value="' + escapeHtml(item.value) + '"' + (item.value === selected ? ' selected' : '') + '>' + escapeHtml(item.label) + '</option>';
    }).join('') + '</select>';
  }

  function openRecordModal(type, id) {
    const record = id ? type === 'course' ? courseById(id) : userById(id) : null;
    if (id && !record) {
      showToast('That record could not be found.');
      return;
    }
    activeRecord = { type: type, id: id || null };
    const fields = document.getElementById('record-fields');
    let markup = '';
    if (type === 'student') {
      markup += recordField('Full name', 'name', record ? record.name : '', 'text', true, ' autocomplete="name"');
      markup += recordField('University email', 'email', record ? record.email : '', 'email', true, ' autocomplete="email"');
      markup += recordField('Department', 'department', record ? record.department : '', 'text', true);
      markup += recordField('Semester', 'semester', record ? record.semester : 'Fall 2026', 'text', true);
      markup += recordField('Password', 'password', '', 'password', !record, ' placeholder="' + (record ? 'Leave blank to keep current' : 'At least 8 characters') + '" minlength="8" autocomplete="new-password"');
    } else if (type === 'faculty') {
      markup += recordField('Full name', 'name', record ? record.name : '', 'text', true);
      markup += recordField('University email', 'email', record ? record.email : '', 'email', true);
      markup += recordField('Department', 'department', record ? record.department : '', 'text', true);
      markup += recordField('Semester', 'semester', record ? record.semester : 'Fall 2026', 'text', true);
      markup += recordField('Password', 'password', '', 'password', !record, ' placeholder="' + (record ? 'Leave blank to keep current' : 'At least 8 characters') + '" minlength="8" autocomplete="new-password"');
    } else {
      markup += recordField('Course code', 'courseCode', record ? record.code : '', 'text', true, record ? ' readonly' : '');
      markup += recordField('Course title', 'courseName', record ? record.title : '', 'text', true);
      markup += recordField('Department', 'department', record ? record.department : '', 'text', true);
      markup += recordField('Semester', 'semester', record ? record.semester : 'Fall 2026', 'text', true);
      if (!record) {
        const facultyOptions = [{ value: '', label: 'Select faculty member' }].concat(store.users.filter(function (user) { return user.role === 'faculty'; }).map(function (user) { return { value: user.id, label: user.name }; }));
        markup += recordSelect('Assigned faculty', 'facultyId', '', facultyOptions, true);
      }
    }
    fields.innerHTML = markup;
    document.getElementById('record-title').textContent = (record ? 'Edit ' : 'Add ') + type;
    document.getElementById('record-message').textContent = '';
    document.getElementById('record-modal').hidden = false;
    document.body.style.overflow = 'hidden';
    fields.querySelector('input, select').focus();
  }

  function closeRecordModal() {
    const modal = document.getElementById('record-modal');
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    activeRecord = null;
  }

  async function saveManagedRecord(event) {
    event.preventDefault();
    if (!activeRecord) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const message = document.getElementById('record-message');
    const type = activeRecord.type;
    const recordId = activeRecord.id;
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    message.textContent = '';
    try {
      if (type === 'course') {
        const body = {
          courseName: String(values.courseName).trim(),
          department: String(values.department).trim(),
          semester: String(values.semester).trim()
        };
        if (recordId) {
          await apiRequest('/admin/courses/' + encodeURIComponent(recordId), { method: 'PATCH', body: body });
        } else {
          body.courseCode = String(values.courseCode).trim().toUpperCase();
          body.facultyId = values.facultyId;
          body.enrolledStudentIds = [];
          await apiRequest('/admin/courses', { method: 'POST', body: body });
        }
      } else {
        const body = {
          name: String(values.name).trim(),
          email: String(values.email).trim(),
          department: String(values.department).trim(),
          semester: String(values.semester).trim()
        };
        if (values.password) body.password = values.password;
        const collection = type === 'student' ? 'students' : 'faculty';
        await apiRequest('/admin/' + collection + (recordId ? '/' + encodeURIComponent(recordId) : ''), {
          method: recordId ? 'PATCH' : 'POST',
          body: body
        });
      }
      await loadAdminData();
      renderAdmin();
      closeRecordModal();
      showToast(type.charAt(0).toUpperCase() + type.slice(1) + ' saved successfully.');
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  }

  async function deleteManagedRecord(type, id) {
    const record = type === 'course' ? courseById(id) : userById(id);
    if (!record || !window.confirm('Remove this ' + type + '? Related enrollment and feedback records may also be removed.')) return;
    try {
      const collection = type === 'course' ? 'courses' : type === 'student' ? 'students' : 'faculty';
      await apiRequest('/admin/' + collection + '/' + encodeURIComponent(id), { method: 'DELETE' });
      await loadAdminData();
      renderAdmin();
      showToast(type.charAt(0).toUpperCase() + type.slice(1) + ' removed successfully.');
    } catch (error) {
      showToast(error.message);
    }
  }

  function showAdminView(view) {
    const validViews = ['dashboard', 'students', 'faculty', 'courses', 'assignments', 'reports'];
    const nextView = validViews.indexOf(view) === -1 ? 'dashboard' : view;
    document.querySelectorAll('[data-admin-section]').forEach(function (section) {
      const active = section.dataset.adminSection === nextView;
      section.hidden = !active;
      section.classList.toggle('active', active);
    });
    document.querySelectorAll('[data-admin-view]').forEach(function (link) {
      link.classList.toggle('active', link.dataset.adminView === nextView);
    });
    const labels = { dashboard: 'Dashboard', students: 'Students', faculty: 'Faculty', courses: 'Courses', assignments: 'Course assignments', reports: 'Reports & analytics' };
    document.getElementById('admin-breadcrumb').textContent = labels[nextView];
    document.getElementById('sidebar').classList.remove('open');
    window.location.hash = nextView;
    renderAdminCharts();
  }

  function csvCell(value) {
    const text = String(value == null ? '' : value);
    const safeText = /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
    return '"' + safeText.replace(/"/g, '""') + '"';
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showToast('Report downloaded.');
  }

  async function handleAssignmentForm(form) {
    const message = form.querySelector('.form-message');
    const kind = form.dataset.assignmentForm;
    const submitButton = form.querySelector('[type="submit"]');
    let path;
    let body;
    if (kind === 'faculty') {
      const course = courseById(document.getElementById('assignment-faculty-course').value);
      const facultyId = document.getElementById('assignment-faculty').value;
      if (!course || !userById(facultyId)) {
        message.textContent = 'Select a valid faculty member and course.';
        return;
      }
      path = '/admin/courses/' + encodeURIComponent(course.id) + '/faculty';
      body = { facultyId: facultyId };
    } else {
      const studentId = document.getElementById('assignment-student').value;
      const courseId = document.getElementById('assignment-student-course').value;
      if (!userById(studentId) || !courseById(courseId)) {
        message.textContent = 'Select a valid student and course.';
        return;
      }
      path = '/admin/courses/' + encodeURIComponent(courseId) + '/students';
      body = { studentId: studentId };
    }
    submitButton.disabled = true;
    message.classList.remove('success');
    message.textContent = '';
    try {
      await apiRequest(path, { method: kind === 'faculty' ? 'PATCH' : 'POST', body: body });
      await loadAdminData();
      renderAdmin();
      message.classList.add('success');
      message.textContent = kind === 'faculty' ? 'Faculty assigned to the course.' : 'Student enrolled in the course.';
      showToast(message.textContent);
      form.reset();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  }

  async function setupAdmin() {
    if (!document.querySelector('[data-admin-section]')) return;
    const demoUser = getStoredUser();
    if (!demoUser || demoUser.role !== 'admin') {
      window.location.href = demoUser ? routeForRole(demoUser.role) : 'index.html';
      return;
    }
    setAdminRowsState('Loading records from the backend…');
    try {
      await loadAdminData();
      renderProfile(getStoredUser());
      renderAdmin();
    } catch (error) {
      setAdminRowsState('Records are unavailable until the API connection is restored.');
      showDashboardError(error.message);
    }
    document.addEventListener('click', function (event) {
      const link = event.target.closest('[data-admin-view]');
      if (link) {
        event.preventDefault();
        showAdminView(link.dataset.adminView);
      }
      const button = event.target.closest('[data-admin-view-button]');
      if (button) showAdminView(button.dataset.adminViewButton);
      const addButton = event.target.closest('[data-add-record]');
      if (addButton) openRecordModal(addButton.dataset.addRecord);
      const editButton = event.target.closest('[data-edit-record]');
      if (editButton) openRecordModal(editButton.dataset.editRecord, editButton.dataset.recordId);
      const deleteButton = event.target.closest('[data-delete-record]');
      if (deleteButton) deleteManagedRecord(deleteButton.dataset.deleteRecord, deleteButton.dataset.recordId);
      const exportButton = event.target.closest('[data-admin-export]');
      if (exportButton) {
        const totals = adminAnalytics ? adminAnalytics.totals : {};
        const distribution = adminAnalytics ? adminAnalytics.ratingDistribution : null;
        const rows = [
          ['SR University Student Feedback Report'],
          ['Generated at', new Date().toISOString()],
          ['Overall average rating', adminAnalytics && adminAnalytics.overallAverage !== null ? adminAnalytics.overallAverage : ''],
          ['Students', totals.students || 0],
          ['Faculty', totals.faculty || 0],
          ['Courses', totals.courses || 0],
          ['Feedback submissions', totals.feedbackSubmissions || 0],
          [],
          ['Parameter averages'],
          ['Parameter', 'Average rating']
        ];
        ratingCategories.forEach(function (category) {
          rows.push([category.label, adminAnalytics && adminAnalytics.parameterAverages[category.key] !== null
            ? adminAnalytics.parameterAverages[category.key]
            : '']);
        });
        rows.push([], ['Rating distribution'], ['Rating', 'Count', 'Percentage']);
        (distribution && distribution.overall ? distribution.overall : []).forEach(function (item) {
          rows.push([item.rating, item.count, item.percentage + '%']);
        });
        rows.push([], ['Department performance'], ['Department', 'Responses', 'Average rating']);
        (adminAnalytics ? adminAnalytics.departmentPerformance : []).forEach(function (item) {
          rows.push([item.department, item.responseCount, item.averageRating === null ? '' : item.averageRating]);
        });
        rows.push([], ['Course performance'], ['Course code', 'Course', 'Department', 'Faculty', 'Responses', 'Average rating']);
        (adminAnalytics ? adminAnalytics.coursePerformance : []).forEach(function (course) {
          const mappedCourse = store.courses.find(function (item) { return item.id === course.courseId; });
          const instructor = mappedCourse ? userById(mappedCourse.facultyId) : null;
          rows.push([course.courseCode, course.courseName, course.department, instructor ? instructor.name : 'Unassigned', course.responseCount, course.averageRating === null ? '' : course.averageRating]);
        });
        rows.push([], ['Top faculty'], ['Rank', 'Faculty', 'Department', 'Responses', 'Average rating']);
        (adminAnalytics ? adminAnalytics.topFaculty : []).forEach(function (item, index) {
          rows.push([index + 1, item.name, item.department, item.responseCount, item.averageRating]);
        });
        downloadCsv('sru-feedback-report.csv', rows);
      }
      if (event.target.closest('[data-close-record]')) closeRecordModal();
      if (event.target.id === 'record-modal') closeRecordModal();
    });
    document.querySelectorAll('[data-table-search]').forEach(function (input) {
      input.addEventListener('input', function () { applyTableSearch(input); });
    });
    document.querySelectorAll('[data-assignment-form]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        handleAssignmentForm(form);
      });
    });
    document.getElementById('record-form').addEventListener('submit', saveManagedRecord);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeRecordModal();
    });
    const initialView = window.location.hash.replace('#', '');
    showAdminView(initialView || 'dashboard');
    window.addEventListener('hashchange', function () {
      const view = window.location.hash.replace('#', '') || 'dashboard';
      if (view !== document.querySelector('[data-admin-section]:not([hidden])').dataset.adminSection) showAdminView(view);
    });
  }

  async function setupFaculty() {
    if (!document.getElementById('faculty-category-chart')) return;
    const demoUser = getStoredUser();
    if (!demoUser || demoUser.role !== 'faculty') {
      window.location.href = demoUser ? routeForRole(demoUser.role) : 'index.html';
      return;
    }
    try {
      await loadFacultyData();
      renderFacultyDashboard();
    } catch (error) {
      showDashboardError(error.message);
    }
    const exportButton = document.querySelector('[data-faculty-export]');
    if (exportButton) exportButton.addEventListener('click', function () {
      const rows = [['Course code', 'Course', 'Responses', 'Average rating'].concat(ratingCategories.map(function (category) {
        return category.label;
      }))];
      (facultyDashboardData ? facultyDashboardData.courses : []).forEach(function (item) {
        rows.push([
          item.course.code,
          item.course.title,
          item.responseCount,
          item.averageRating === null ? '' : item.averageRating
        ].concat(ratingCategories.map(function (category) {
          const value = item.categoryAverages[category.key];
          return value === null ? '' : value;
        })));
      });
      downloadCsv('faculty-feedback-summary.csv', rows);
    });
    const views = { overview: ['Overview', 'faculty-overview'], courses: ['My courses', 'faculty-courses'], comments: ['Student comments', 'faculty-comments'] };
    function activateFacultyView(view) {
      const selectedView = views[view] ? view : 'overview';
      const targetId = views[selectedView][1];
      document.getElementById('faculty-breadcrumb').textContent = views[selectedView][0];
      document.querySelectorAll('[data-faculty-view]').forEach(function (item) {
        item.classList.toggle('active', item.dataset.facultyView === selectedView);
      });
      document.getElementById(targetId).scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('sidebar').classList.remove('open');
      if (window.location.hash !== '#' + targetId) window.location.hash = targetId;
    }
    document.querySelectorAll('[data-faculty-view]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        activateFacultyView(link.dataset.facultyView);
      });
    });
    window.addEventListener('hashchange', function () {
      const hash = window.location.hash.slice(1);
      const view = Object.keys(views).find(function (key) { return views[key][1] === hash; }) || 'overview';
      activateFacultyView(view);
    });
    const initialHash = window.location.hash.slice(1);
    const initialView = Object.keys(views).find(function (key) { return views[key][1] === initialHash; }) || 'overview';
    activateFacultyView(initialView);
  }

  setupLogin();
  setupCommon();
  if (document.body.dataset.page === 'student') setupStudent();
  if (document.body.dataset.page === 'faculty') setupFaculty();
  if (document.body.dataset.page === 'admin') setupAdmin();
}());
