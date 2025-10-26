import { useState, useEffect } from 'react';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Switch, 
  Select, 
  message, 
  Tabs, 
  Avatar, 
  Upload, 
  Space, 
  Divider, 
  Row, 
  Col,
  TimePicker,
  InputNumber,
  notification,
  Alert
} from 'antd';
import { 
  UserOutlined, 
  MailOutlined, 
  LockOutlined, 
  PhoneOutlined, 
  UploadOutlined, 
  BellOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  GlobalOutlined,
  SecurityScanOutlined,
  NotificationOutlined,
  SaveOutlined
} from '@ant-design/icons';
import { useAuth } from '../../lib/auth';
import dayjs from 'dayjs';

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

// Mock data - replace with actual API calls
const mockUserData = {
  id: 'user123',
  name: 'John Doe',
  email: 'john.doe@example.com',
  phone: '+1 (555) 123-4567',
  avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
  department: 'Computer Science',
  position: 'Senior Lecturer',
  bio: 'Passionate educator with 10+ years of experience in teaching computer science and software engineering.',
  notifications: {
    email: {
      attendanceUpdates: true,
      systemAlerts: true,
      newsletter: false,
    },
    push: {
      attendanceReminders: true,
      classReminders: true,
      announcements: true,
    },
    schedule: {
      startTime: '08:00',
      endTime: '17:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    },
    lowAttendanceThreshold: 70,
  },
  security: {
    twoFactorEnabled: true,
    lastLogin: '2023-11-10T14:30:00Z',
    loginHistory: [
      { id: 1, date: '2023-11-10T14:30:00Z', device: 'Chrome on Windows', location: 'New York, NY', ip: '192.168.1.1' },
      { id: 2, date: '2023-11-09T09:15:00Z', device: 'Safari on iPhone', location: 'Boston, MA', ip: '192.168.1.2' },
      { id: 3, date: '2023-11-08T16:45:00Z', device: 'Chrome on Windows', location: 'New York, NY', ip: '192.168.1.1' },
    ],
  },
};

const daysOfWeek = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

type NotificationSettings = typeof mockUserData.notifications;
type SecuritySettings = typeof mockUserData.security;

const Settings = () => {
  const [form] = Form.useForm();
  const [profileForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    // Load user data
    loadUserData();
  }, []);

  const loadUserData = () => {
    // In a real app, this would be an API call
    setTimeout(() => {
      profileForm.setFieldsValue({
        name: mockUserData.name,
        email: mockUserData.email,
        phone: mockUserData.phone,
        department: mockUserData.department,
        position: mockUserData.position,
        bio: mockUserData.bio,
      });
      setImageUrl(mockUserData.avatar);
    }, 500);
  };

  const handleProfileUpdate = async (values: any) => {
    setLoading(true);
    try {
      // In a real app, this would be an API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      message.success('Profile updated successfully');
      // Update the mock data
      Object.assign(mockUserData, values);
    } catch (error) {
      console.error('Error updating profile:', error);
      message.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('New passwords do not match');
      return;
    }

    setLoading(true);
    try {
      // In a real app, this would be an API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      message.success('Password updated successfully');
      form.resetFields(['currentPassword', 'newPassword', 'confirmPassword']);
    } catch (error) {
      console.error('Error updating password:', error);
      message.error('Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationChange = (changedValues: any, allValues: any) => {
    console.log('Notification settings updated:', allValues);
    // In a real app, this would be an API call
    Object.assign(mockUserData.notifications, allValues);
  };

  const handleSecurityChange = (changedValues: any, allValues: any) => {
    console.log('Security settings updated:', allValues);
    // In a real app, this would be an API call
    Object.assign(mockUserData.security, allValues);
  };

  const beforeUpload = (file: File) => {
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
    if (!isJpgOrPng) {
      message.error('You can only upload JPG/PNG files!');
      return false;
    }
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('Image must be smaller than 2MB!');
      return false;
    }
    return true;
  };

  const handleUpload = (info: any) => {
    if (info.file.status === 'done') {
      // In a real app, you would upload the file to your server here
      const reader = new FileReader();
      reader.readAsDataURL(info.file.originFileObj);
      reader.onload = () => {
        setImageUrl(reader.result as string);
        message.success('Profile picture updated successfully');
      };
    } else if (info.file.status === 'error') {
      message.error('Upload failed');
    }
  };

  const handleExportData = () => {
    // In a real app, this would trigger a data export
    message.loading('Preparing your data export...', 2)
      .then(() => message.success('Export completed. Check your email for the download link.'));
  };

  const handleDeleteAccount = () => {
    // In a real app, this would show a confirmation modal
    notification.warning({
      message: 'Account Deletion',
      description: 'This action cannot be undone. All your data will be permanently deleted.',
      btn: (
        <Button 
          type="primary" 
          danger 
          onClick={() => {
            notification.destroy();
            message.loading('Deleting your account...', 2)
              .then(() => message.info('Account deletion request received. You will receive a confirmation email.'));
          }}
        >
          I understand, delete my account
        </Button>
      ),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-gray-500">Manage your account settings and preferences</p>
      </div>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        type="card"
        className="settings-tabs"
      >
        <TabPane
          tab={
            <span>
              <UserOutlined />
              <span>Profile</span>
            </span>
          }
          key="profile"
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} md={8}>
              <Card title="Profile Picture" className="h-full">
                <div className="flex flex-col items-center">
                  <Avatar 
                    size={128} 
                    src={imageUrl} 
                    icon={!imageUrl ? <UserOutlined /> : null}
                    className="mb-4"
                  />
                  <Upload
                    name="avatar"
                    showUploadList={false}
                    beforeUpload={beforeUpload}
                    onChange={handleUpload}
                    customRequest={({ onSuccess }: any) => onSuccess('ok')}
                  >
                    <Button icon={<UploadOutlined />}>Change Photo</Button>
                  </Upload>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    JPG, GIF or PNG. Max size of 2MB
                  </p>
                </div>
              </Card>

              <Card title="Account Security" className="mt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">Two-Factor Authentication</div>
                      <div className="text-sm text-gray-500">
                        {mockUserData.security.twoFactorEnabled 
                          ? 'Enabled' 
                          : 'Add an extra layer of security'}
                      </div>
                    </div>
                    <Switch 
                      checked={mockUserData.security.twoFactorEnabled} 
                      onChange={(checked) => handleSecurityChange({ twoFactorEnabled: checked }, { ...mockUserData.security, twoFactorEnabled: checked })}
                    />
                  </div>
                  
                  <Divider className="my-4" />
                  
                  <div>
                    <div className="font-medium mb-2">Recent Logins</div>
                    <div className="space-y-3">
                      {mockUserData.security.loginHistory.map(login => (
                        <div key={login.id} className="text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">{login.device}</span>
                            <span className="text-gray-500">
                              {dayjs(login.date).fromNow()}
                            </span>
                          </div>
                          <div className="text-gray-500">
                            {login.location} • {login.ip}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={24} md={16}>
              <Card title="Profile Information">
                <Form
                  form={profileForm}
                  layout="vertical"
                  onFinish={handleProfileUpdate}
                  initialValues={{
                    name: '',
                    email: '',
                    phone: '',
                    department: '',
                    position: '',
                    bio: '',
                  }}
                >
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="name"
                        label="Full Name"
                        rules={[{ required: true, message: 'Please enter your name' }]}
                      >
                        <Input prefix={<UserOutlined />} placeholder="John Doe" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                          { required: true, message: 'Please enter your email' },
                          { type: 'email', message: 'Please enter a valid email' },
                        ]}
                      >
                        <Input prefix={<MailOutlined />} placeholder="email@example.com" />
                      </Form.Item>
                    </Col>
                  </Row>
                  
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="phone"
                        label="Phone Number"
                      >
                        <Input prefix={<PhoneOutlined />} placeholder="+1 (555) 123-4567" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="department"
                        label="Department"
                      >
                        <Input placeholder="Computer Science" />
                      </Form.Item>
                    </Col>
                  </Row>
                  
                  <Form.Item
                    name="position"
                    label="Position / Title"
                  >
                    <Input placeholder="Senior Lecturer" />
                  </Form.Item>
                  
                  <Form.Item
                    name="bio"
                    label="Bio"
                  >
                    <TextArea rows={4} placeholder="Tell us about yourself..." />
                  </Form.Item>
                  
                  <div className="flex justify-end">
                    <Button 
                      type="primary" 
                      htmlType="submit" 
                      loading={loading}
                      icon={<SaveOutlined />}
                    >
                      Save Changes
                    </Button>
                  </div>
                </Form>
              </Card>
              
              <Card title="Change Password" className="mt-6">
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handlePasswordChange}
                >
                  <Form.Item
                    name="currentPassword"
                    label="Current Password"
                    rules={[{ required: true, message: 'Please enter your current password' }]}
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="Current password" />
                  </Form.Item>
                  
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="newPassword"
                        label="New Password"
                        rules={[
                          { required: true, message: 'Please enter a new password' },
                          { min: 8, message: 'Password must be at least 8 characters' },
                        ]}
                      >
                        <Input.Password prefix={<LockOutlined />} placeholder="New password" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item
                        name="confirmPassword"
                        label="Confirm New Password"
                        dependencies={['newPassword']}
                        rules={[
                          { required: true, message: 'Please confirm your new password' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('newPassword') === value) {
                                return Promise.resolve();
                              }
                              return Promise.reject(new Error('The two passwords do not match'));
                            },
                          }),
                        ]}
                      >
                        <Input.Password prefix={<LockOutlined />} placeholder="Confirm new password" />
                      </Form.Item>
                    </Col>
                  </Row>
                  
                  <div className="flex justify-end">
                    <Button 
                      type="primary" 
                      htmlType="submit" 
                      loading={loading}
                      icon={<CheckCircleOutlined />}
                    >
                      Update Password
                    </Button>
                  </div>
                </Form>
              </Card>
            </Col>
          </Row>
        </TabPane>

        <TabPane
          tab={
            <span>
              <BellOutlined />
              <span>Notifications</span>
            </span>
          }
          key="notifications"
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} md={12}>
              <Card title="Email Notifications">
                <Form
                  layout="vertical"
                  initialValues={mockUserData.notifications.email}
                  onValuesChange={(_, allValues) => handleNotificationChange(_, { ...mockUserData.notifications, email: allValues })}
                >
                  <Form.Item
                    name="attendanceUpdates"
                    label="Attendance Updates"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    name="systemAlerts"
                    label="System Alerts"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    name="newsletter"
                    label="Newsletter"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Form>
              </Card>
              
              <Card title="Notification Schedule" className="mt-6">
                <Form
                  layout="vertical"
                  initialValues={{
                    ...mockUserData.notifications.schedule,
                    days: mockUserData.notifications.schedule.days,
                    timeRange: [
                      dayjs(mockUserData.notifications.schedule.startTime, 'HH:mm'),
                      dayjs(mockUserData.notifications.schedule.endTime, 'HH:mm'),
                    ],
                  }}
                  onValuesChange={(_, allValues) => {
                    const [startTime, endTime] = allValues.timeRange || [];
                    handleNotificationChange(_, {
                      ...mockUserData.notifications,
                      schedule: {
                        ...mockUserData.notifications.schedule,
                        startTime: startTime?.format('HH:mm') || mockUserData.notifications.schedule.startTime,
                        endTime: endTime?.format('HH:mm') || mockUserData.notifications.schedule.endTime,
                        days: allValues.days || mockUserData.notifications.schedule.days,
                      },
                    });
                  }}
                >
                  <Form.Item
                    name="timeRange"
                    label="Notification Hours"
                  >
                    <TimePicker.RangePicker 
                      format="h:mm A" 
                      use12Hours 
                      className="w-full"
                    />
                  </Form.Item>
                  
                  <Form.Item
                    name="days"
                    label="Notification Days"
                  >
                    <Select 
                      mode="multiple" 
                      placeholder="Select days"
                      optionLabelProp="label"
                      className="w-full"
                    >
                      {daysOfWeek.map(day => (
                        <Option key={day.value} value={day.value} label={day.label}>
                          {day.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Form>
              </Card>
            </Col>
            
            <Col xs={24} md={12}>
              <Card title="Push Notifications">
                <Form
                  layout="vertical"
                  initialValues={mockUserData.notifications.push}
                  onValuesChange={(_, allValues) => handleNotificationChange(_, { ...mockUserData.notifications, push: allValues })}
                >
                  <Form.Item
                    name="attendanceReminders"
                    label="Attendance Reminders"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    name="classReminders"
                    label="Class Reminders"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                  <Form.Item
                    name="announcements"
                    label="Announcements"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Form>
              </Card>
              
              <Card title="Attendance Alerts" className="mt-6">
                <Form
                  layout="vertical"
                  initialValues={{
                    lowAttendanceThreshold: mockUserData.notifications.lowAttendanceThreshold,
                  }}
                  onValuesChange={(_, allValues) => 
                    handleNotificationChange(_, { 
                      ...mockUserData.notifications, 
                      lowAttendanceThreshold: allValues.lowAttendanceThreshold 
                    })
                  }
                >
                  <Form.Item
                    name="lowAttendanceThreshold"
                    label="Low Attendance Alert Threshold"
                    tooltip="Get notified when a student's attendance drops below this percentage"
                  >
                    <InputNumber 
                      min={0} 
                      max={100} 
                      formatter={value => `${value}%`}
                      parser={value => (value ? parseInt(value.replace('%', '')) : 0)}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                  
                  <Alert 
                    message="Notification Preferences" 
                    description="You will receive alerts when a student's attendance rate falls below the specified threshold."
                    type="info"
                    showIcon
                    className="mt-4"
                  />
                </Form>
              </Card>
            </Col>
          </Row>
        </TabPane>
        
        <TabPane
          tab={
            <span>
              <SecurityScanOutlined />
              <span>Security</span>
            </span>
          }
          key="security"
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} md={12}>
              <Card title="Two-Factor Authentication">
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="flex-1">
                      <div className="font-medium">Two-Factor Authentication</div>
                      <div className="text-gray-500 text-sm">
                        Add an extra layer of security to your account by enabling two-factor authentication.
                      </div>
                    </div>
                    <Switch 
                      checked={mockUserData.security.twoFactorEnabled}
                      onChange={(checked) => handleSecurityChange({ twoFactorEnabled: checked }, { ...mockUserData.security, twoFactorEnabled: checked })}
                    />
                  </div>
                  
                  {mockUserData.security.twoFactorEnabled && (
                    <div className="bg-blue-50 p-4 rounded-md">
                      <div className="font-medium mb-2">Two-Factor Authentication is enabled</div>
                      <p className="text-sm text-gray-600 mb-3">
                        You'll be asked to enter a verification code when signing in.
                      </p>
                      <Button type="primary" size="small">Manage 2FA Settings</Button>
                    </div>
                  )}
                  
                  <Divider />
                  
                  <div>
                    <div className="font-medium mb-2">Recovery Codes</div>
                    <p className="text-sm text-gray-600 mb-3">
                      Keep these codes in a safe place. You can use them to access your account if you lose access to your authentication device.
                    </p>
                    <Button type="default" size="small">View Recovery Codes</Button>
                  </div>
                </div>
              </Card>
              
              <Card title="Active Sessions" className="mt-6">
                <div className="space-y-4">
                  {mockUserData.security.loginHistory.map(session => (
                    <div key={session.id} className="flex items-start justify-between p-3 border rounded-md hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="font-medium">{session.device}</div>
                        <div className="text-sm text-gray-500">{session.location} • {session.ip}</div>
                        <div className="text-xs text-gray-400">
                          {dayjs(session.date).format('MMM D, YYYY [at] h:mm A')}
                        </div>
                      </div>
                      <div>
                        {session.id === 1 ? (
                          <Tag color="green">Current Session</Tag>
                        ) : (
                          <Button type="link" danger size="small">Revoke</Button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  <div className="text-center mt-4">
                    <Button type="link">View all sessions</Button>
                  </div>
                </div>
              </Card>
            </Col>
            
            <Col xs={24} md={12}>
              <Card title="Password & Security" className="h-full">
                <div className="space-y-6">
                  <div>
                    <div className="font-medium mb-2">Password</div>
                    <p className="text-sm text-gray-600 mb-3">
                      Last changed {dayjs().subtract(45, 'day').fromNow()}
                    </p>
                    <Button 
                      type="default" 
                      onClick={() => setActiveTab('profile')}
                    >
                      Change Password
                    </Button>
                  </div>
                  
                  <Divider />
                  
                  <div>
                    <div className="font-medium mb-2">Data Export</div>
                    <p className="text-sm text-gray-600 mb-3">
                      Download a copy of all your personal data, including your profile information and activity history.
                    </p>
                    <Button 
                      type="default" 
                      icon={<DownloadOutlined />}
                      onClick={handleExportData}
                    >
                      Request Data Export
                    </Button>
                  </div>
                  
                  <Divider />
                  
                  <div>
                    <div className="font-medium mb-2 text-red-600">Delete Account</div>
                    <p className="text-sm text-gray-600 mb-3">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <Button 
                      danger 
                      type="default"
                      onClick={handleDeleteAccount}
                    >
                      Delete My Account
                    </Button>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </TabPane>
        
        <TabPane
          tab={
            <span>
              <GlobalOutlined />
              <span>Preferences</span>
            </span>
          }
          key="preferences"
        >
          <Row gutter={[24, 24]}>
            <Col xs={24} md={12}>
              <Card title="Language & Region">
                <Form layout="vertical">
                  <Form.Item
                    name="language"
                    label="Language"
                    initialValue="en"
                  >
                    <Select>
                      <Option value="en">English</Option>
                      <Option value="es">Español</Option>
                      <Option value="fr">Français</Option>
                      <Option value="de">Deutsch</Option>
                      <Option value="zh">中文</Option>
                    </Select>
                  </Form.Item>
                  
                  <Form.Item
                    name="timezone"
                    label="Time Zone"
                    initialValue="America/New_York"
                  >
                    <Select showSearch>
                      <Option value="America/New_York">(GMT-05:00) Eastern Time (US & Canada)</Option>
                      <Option value="America/Chicago">(GMT-06:00) Central Time (US & Canada)</Option>
                      <Option value="America/Denver">(GMT-07:00) Mountain Time (US & Canada)</Option>
                      <Option value="America/Los_Angeles">(GMT-08:00) Pacific Time (US & Canada)</Option>
                      <Option value="Europe/London">(GMT+00:00) London</Option>
                      <Option value="Europe/Paris">(GMT+01:00) Paris</Option>
                      <Option value="Asia/Dubai">(GMT+04:00) Dubai</Option>
                      <Option value="Asia/Shanghai">(GMT+08:00) Beijing, Shanghai</Option>
                      <Option value="Asia/Tokyo">(GMT+09:00) Tokyo</Option>
                      <Option value="Australia/Sydney">(GMT+10:00) Sydney</Option>
                    </Select>
                  </Form.Item>
                  
                  <Form.Item
                    name="dateFormat"
                    label="Date Format"
                    initialValue="MM/DD/YYYY"
                  >
                    <Select>
                      <Option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2023)</Option>
                      <Option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2023)</Option>
                      <Option value="YYYY-MM-DD">YYYY-MM-DD (2023-12-31)</Option>
                      <Option value="MMM D, YYYY">MMM D, YYYY (Dec 31, 2023)</Option>
                      <Option value="D MMM, YYYY">D MMM, YYYY (31 Dec, 2023)</Option>
                    </Select>
                  </Form.Item>
                  
                  <Form.Item
                    name="timeFormat"
                    label="Time Format"
                    initialValue="12h"
                  >
                    <Select>
                      <Option value="12h">12-hour (2:30 PM)</Option>
                      <Option value="24h">24-hour (14:30)</Option>
                    </Select>
                  </Form.Item>
                </Form>
              </Card>
            </Col>
            
            <Col xs={24} md={12}>
              <Card title="Display Settings">
                <Form layout="vertical">
                  <Form.Item
                    name="theme"
                    label="Theme"
                    initialValue="system"
                  >
                    <Select>
                      <Option value="system">System Default</Option>
                      <Option value="light">Light</Option>
                      <Option value="dark">Dark</Option>
                    </Select>
                  </Form.Item>
                  
                  <Form.Item
                    name="density"
                    label="Density"
                    initialValue="comfortable"
                  >
                    <Select>
                      <Option value="compact">Compact</Option>
                      <Option value="comfortable">Comfortable (Default)</Option>
                      <Option value="spacious">Spacious</Option>
                    </Select>
                  </Form.Item>
                  
                  <Form.Item
                    name="fontSize"
                    label="Font Size"
                    initialValue="medium"
                  >
                    <Select>
                      <Option value="small">Small</Option>
                      <Option value="medium">Medium (Default)</Option>
                      <Option value="large">Large</Option>
                    </Select>
                  </Form.Item>
                  
                  <Form.Item
                    name="notifications"
                    label="Desktop Notifications"
                    valuePropName="checked"
                    initialValue={true}
                  >
                    <Switch />
                  </Form.Item>
                  
                  <Form.Item
                    name="sounds"
                    label="Interface Sounds"
                    valuePropName="checked"
                    initialValue={true}
                  >
                    <Switch />
                  </Form.Item>
                </Form>
                
                <div className="mt-6">
                  <Button type="primary" block>Save Preferences</Button>
                </div>
              </Card>
              
              <Card title="Data & Privacy" className="mt-6">
                <div className="space-y-4">
                  <div>
                    <div className="font-medium">Data Collection</div>
                    <p className="text-sm text-gray-600">
                      We collect anonymous usage data to improve our services. Your personal information is never shared with third parties.
                    </p>
                    <Button type="link" size="small" className="p-0">Learn more</Button>
                  </div>
                  
                  <div>
                    <div className="font-medium">Privacy Controls</div>
                    <p className="text-sm text-gray-600">
                      Control what information is visible to other users and third-party applications.
                    </p>
                    <Button type="link" size="small" className="p-0">Manage privacy settings</Button>
                  </div>
                  
                  <div>
                    <div className="font-medium">Clear Local Data</div>
                    <p className="text-sm text-gray-600">
                      Clear all data stored in your browser, including preferences and cached files.
                    </p>
                    <Button 
                      type="link" 
                      size="small" 
                      className="p-0"
                      onClick={() => message.info('Local data cleared')}
                    >
                      Clear Data
                    </Button>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Settings;
